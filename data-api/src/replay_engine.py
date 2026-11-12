"""
replay_engine.py
-----------------
Core simulation logic: replays historical Ausgrid data on a compressed
timeline (one "tick" = one simulated half-hour), calls the trained
forecasting models, and writes rows matching the shared Supabase tables.
Deliberately has NO FastAPI import -- main.py just wraps it.

What changed in this version (and why):

1. UPSERT, NOT INSERT. Rows are written with "upsert" using a unique key
   (household_id + ts, or ts for grid_status). Running or restarting the
   replay now OVERWRITES the same rows instead of piling up duplicates.
   This needs the unique constraints from the Supabase SQL clean-up to exist.

2. net_kwh IS NOW CONSISTENT: net_kwh = gc_kwh + cl_kwh - gg_kwh (positive =
   importing from the grid, negative = exporting solar). Before, live rows
   wrongly stored gc + cl, which clashed with the seeded history.

3. ONE FORECAST ROW PER HOUSE PER TICK, with both predicted columns filled
   (predicted_consumption_kwh and predicted_generation_kwh). Before there were
   two half-empty rows per house, which confused Power BI.

4. REPLAY ENDS. It stops at end_time instead of running for months, so the
   tables can never grow without limit. reset() wipes the live rows and rewinds.

5. peak_flag uses the 90th percentile of the live houses' own demand, instead
   of a made-up number that was never reached.

6. estimate_backup(): outage-backup estimate -- how much energy each non-solar
   house would need over the next X hours, and which solar houses could cover it.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

import pandas as pd

from src.predict import Forecaster

logger = logging.getLogger("replay_engine")

# SOURCE_TAG must NEVER change -- v_live_consumption specifically filters:
#   WHERE source = 'simulated'
SOURCE_TAG = "simulated"  # value written to consumption_readings.source

# Which columns make a row "the same row" -- must match the unique constraints in Supabase.
CONFLICT_KEYS = {
    "consumption_readings": "household_id,ts",
    "forecasts": "household_id,ts",
    "grid_status": "ts",
}


class RowSink(Protocol):
    """Anything that can accept rows for a named table and clear the live data."""

    def write(self, table: str, rows: list[dict]) -> None: ...

    def reset(self) -> None: ...

    def fetch_live_household_ids(self) -> list[int] | None: ...


class DryRunSink:
    """Collects rows in memory instead of hitting Supabase (for local testing)."""

    def __init__(self):
        self.written: dict[str, list[dict]] = {}

    def write(self, table: str, rows: list[dict]) -> None:
        if not rows:
            return
        self.written.setdefault(table, []).extend(rows)
        logger.info("[dry-run] would write %d rows to '%s'", len(rows), table)

    def reset(self) -> None:
        self.written.clear()
        logger.info("[dry-run] cleared in-memory rows")

    def fetch_live_household_ids(self) -> list[int] | None:
        return None


class SupabaseSink:
    """Real sink -- writes to Supabase via the service role key."""

    def __init__(self, url: str, service_role_key: str):
        from supabase import create_client
        self.client = create_client(url, service_role_key)

    def write(self, table: str, rows: list[dict]) -> None:
        if not rows:
            return
        self.client.table(table).upsert(rows, on_conflict=CONFLICT_KEYS[table]).execute()

    def reset(self) -> None:
        """Delete live replay data only. households and trades are never touched."""
        self.client.table("consumption_readings").delete().eq("source", SOURCE_TAG).execute()
        self.client.table("forecasts").delete().neq("id", 0).execute()
        self.client.table("grid_status").delete().neq("id", 0).execute()

    def fetch_live_household_ids(self) -> list[int] | None:
        """Fetch all household_ids from Supabase where in_live_sim = true."""
        try:
            res = self.client.table("households").select("household_id").eq("in_live_sim", True).execute()
            if res.data:
                return sorted(int(row["household_id"]) for row in res.data)
            return []
        except Exception as e:
            logger.warning("Could not fetch in_live_sim households from Supabase: %s", e)
            return None


@dataclass
class ReplayEngine:
    data: pd.DataFrame           # cleaned Ausgrid rows for the LIVE households only
    models_dir: Path
    sink: RowSink
    start_time: pd.Timestamp
    end_time: pd.Timestamp | None = None
    tick_delta: pd.Timedelta = field(default_factory=lambda: pd.Timedelta(minutes=30))
    household_categories: list[int] | None = None   # all 300 ids the model was trained with
    supabase_live_ids: list[int] | None = None
    ids_match: bool | None = None

    def __post_init__(self):
        self.current_time = self.start_time
        self._forecaster = Forecaster(self.models_dir, household_categories=self.household_categories)

        if "net_load_kwh" not in self.data.columns:
            self.data = self.data.assign(net_load_kwh=self.data["gc_kwh"] + self.data["cl_kwh"])

        # Index once for fast per-tick lookups instead of filtering millions of rows every tick.
        self._by_time = self.data.set_index("timestamp").sort_index()
        self.household_ids = sorted(int(h) for h in self.data["household_id"].unique())

        # A house counts as "solar" if it ever generates anything.
        self._is_solar = (self.data.groupby("household_id")["gg_kwh"].max() > 0).to_dict()

        totals = (self.data["gc_kwh"] + self.data["cl_kwh"]).groupby(self.data["timestamp"]).sum()
        self.peak_threshold = float(totals.quantile(0.9))

        logger.info(
            "ReplayEngine ready: %d households (%d solar), %s -> %s, tick=%s, peak threshold=%.2f kWh",
            len(self.household_ids), sum(self._is_solar.values()),
            self.start_time, self.end_time, self.tick_delta, self.peak_threshold,
        )

    # ------------------------------------------------------------------ helpers
    @property
    def finished(self) -> bool:
        return self.end_time is not None and self.current_time > self.end_time

    def _rows_at(self, ts: pd.Timestamp) -> pd.DataFrame:
        if ts not in self._by_time.index:
            return pd.DataFrame()
        return self._by_time.loc[[ts]]

    def _window(self, upto: pd.Timestamp) -> pd.DataFrame:
        """The last 10 days up to `upto` -- enough for the biggest lag (7 days)."""
        return self._by_time.loc[upto - pd.Timedelta(days=10): upto].reset_index()

    def reset(self) -> None:
        """Clear the live rows in Supabase and rewind the replay to the start."""
        self.sink.reset()
        self.current_time = self.start_time

    # --------------------------------------------------------------------- tick
    def tick(self) -> dict:
        """Advance one half-hour: write readings + grid status + next-tick forecasts."""
        ts = self.current_time

        if self.finished:
            return {"timestamp": str(ts), "finished": True, "note": "replay window finished"}

        current_rows = self._rows_at(ts)
        if current_rows.empty:
            logger.warning("No data at %s (reached the end of the dataset?)", ts)
            return {"timestamp": str(ts), "finished": True, "note": "no data at this timestamp"}

        # 1. consumption_readings (what the "smart meters" report right now)
        consumption_rows = [
            {
                "household_id": int(r.household_id),
                "ts": ts.isoformat(),
                "gc_kwh": round(float(r.gc_kwh), 4),
                "cl_kwh": round(float(r.cl_kwh), 4),
                "gg_kwh": round(float(r.gg_kwh), 4),
                "net_kwh": round(float(r.gc_kwh) + float(r.cl_kwh) - float(r.gg_kwh), 4),
                "source": SOURCE_TAG,
            }
            for r in current_rows.itertuples()
        ]
        self.sink.write("consumption_readings", consumption_rows)

        # 2. grid_status (whole-community totals for this tick)
        total_demand = float((current_rows["gc_kwh"] + current_rows["cl_kwh"]).sum())
        total_supply = float(current_rows["gg_kwh"].sum())
        self.sink.write("grid_status", [{
            "ts": ts.isoformat(),
            "total_demand": round(total_demand, 4),
            "total_supply": round(total_supply, 4),
            "peak_flag": total_demand > self.peak_threshold,
        }])

        # 3. forecasts for the NEXT tick, one merged row per household
        recent_window = self._window(ts)
        by_house: dict[int, dict] = {}
        for target, column in (("net_load_kwh", "predicted_consumption_kwh"),
                               ("gg_kwh", "predicted_generation_kwh")):
            try:
                preds = self._forecaster.predict(recent_window, target=target)
            except FileNotFoundError as e:
                logger.warning("Skipping forecasts for %s: %s", target, e)
                continue
            for r in preds.itertuples():
                row = by_house.setdefault(int(r.household_id), {
                    "household_id": int(r.household_id),
                    "ts": pd.Timestamp(r.timestamp).isoformat(),
                    # model_used must NEVER change -- views and Power BI contract depend on "xgboost_v1"
                    "model_used": "xgboost_v1",
                })
                row[column] = round(float(r.predicted_kwh), 4)
        forecast_rows = list(by_house.values())
        self.sink.write("forecasts", forecast_rows)

        self.current_time = ts + self.tick_delta

        return {
            "timestamp": ts.isoformat(),
            "finished": False,
            "households": len(current_rows),
            "total_demand": total_demand,
            "total_supply": total_supply,
            "forecasts_written": len(forecast_rows),
        }

    # ------------------------------------------------------------ outage backup
    def estimate_backup(self, hours: float) -> dict:
        """
        "If the power went out right now for `hours` hours, how much energy would
        each non-solar house need, and which solar houses could cover it?"

        - need of a non-solar house   = sum of its predicted consumption over the window
        - surplus of a solar house    = predicted generation minus its OWN predicted
                                        consumption, counted only in half-hours where
                                        it is positive (there is no battery in the data,
                                        so surplus only exists while the sun is out)
        - matching: biggest need first, taking from the solar house with the most
                    surplus left, splitting across houses when needed.
        Only information up to the last replayed tick is used (no peeking ahead).
        """
        steps = max(1, int(round(hours * 2)))
        last_ts = self.current_time - self.tick_delta
        window = self._window(last_ts)

        cons = self._forecaster.predict_horizon(window, "net_load_kwh", steps)
        gen = self._forecaster.predict_horizon(window, "gg_kwh", steps)
        if cons.empty or gen.empty:
            return {"error": "Not enough history to forecast yet"}

        merged = (
            cons.rename(columns={"predicted_kwh": "cons"})[["household_id", "timestamp", "cons"]]
            .merge(gen.rename(columns={"predicted_kwh": "gen"})[["household_id", "timestamp", "gen"]],
                   on=["household_id", "timestamp"])
        )
        merged["surplus"] = (merged["gen"] - merged["cons"]).clip(lower=0)
        per_house = merged.groupby("household_id").agg(need=("cons", "sum"), surplus=("surplus", "sum"))

        solar = [int(h) for h in per_house.index if self._is_solar.get(int(h), False)]
        non_solar = [int(h) for h in per_house.index if not self._is_solar.get(int(h), False)]

        remaining = {h: float(per_house.loc[h, "surplus"]) for h in solar}
        supplied = {h: 0.0 for h in solar}
        allocations, needs_out = [], []

        for cid in sorted(non_solar, key=lambda h: -float(per_house.loc[h, "need"])):
            need = float(per_house.loc[cid, "need"])
            left = need
            for sid in sorted(remaining, key=lambda s: -remaining[s]):
                if left <= 1e-9:
                    break
                give = min(left, remaining[sid])
                if give > 1e-9:
                    allocations.append({"from_household_id": sid, "to_household_id": cid, "kwh": round(give, 3)})
                    remaining[sid] -= give
                    supplied[sid] += give
                    left -= give
            needs_out.append({
                "household_id": cid,
                "need_kwh": round(need, 3),
                "covered_kwh": round(need - left, 3),
                "shortfall_kwh": round(left, 3),
            })

        return {
            "hours": hours,
            "outage_starts_at": (last_ts + self.tick_delta).isoformat(),
            "window_ends_at": pd.Timestamp(merged["timestamp"].max()).isoformat(),
            "needs": needs_out,
            "suppliers": [
                {"household_id": h,
                 "surplus_kwh": round(float(per_house.loc[h, "surplus"]), 3),
                 "committed_kwh": round(supplied[h], 3)}
                for h in solar
            ],
            "allocations": allocations,
            "note": "Solar houses have no battery here, so surplus only exists in daylight hours.",
        }