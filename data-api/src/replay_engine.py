"""
replay_engine.py
-----------------
Core simulation logic for replaying historical Ausgrid data on a
compressed timeline, calling the trained forecasting models, and shaping
everything into rows matching the shared Supabase tables. Deliberately has
NO FastAPI import -- this is testable on its own, and main.py just wraps it.

Design decisions worth knowing (and flagging to your team):

1. WHICH HOUSEHOLDS REPLAY: defaults to the 30-household sim subset
   (ausgrid_sim_subset.csv from clean_ausgrid.py), not all 300. The
   forecasting MODEL is trained on all 300 for accuracy, but the live demo
   only needs to visibly simulate a manageable community -- 300 simultaneous
   households would flood the dashboard and Supabase writes with no benefit
   to the demo. Override with --households if you want otherwise.

2. WHERE REPLAY STARTS: 2012-07-01 by default -- the start of the model's
   TEST period. This means forecasts and actuals are both meaningful and
   comparable during the whole demo, instead of replaying training-period
   data where the model has already "seen the answer."

3. WHAT `consumption_readings.kwh_reading` MEANS: this is a genuinely open
   question in your shared schema (see project brief) -- Ausgrid gives you
   THREE numbers per household (gc, cl, gg), but the schema has only ONE
   kwh_reading column. This script writes NET demand
   (net_kwh = gc_kwh + cl_kwh - gg_kwh), matching how a real net-metered
   smart meter reports (positive = importing, negative = exporting surplus).
   CONFIRM this interpretation with your website teammate -- if they expect
   gross consumption instead, this needs to change before integration.

4. FORECASTS: the shared `forecasts` table also has one `predicted_kwh`
   column, not two. This script writes TWO rows per household per tick --
   one with model_used="xgboost_net_load_kwh", one with
   model_used="xgboost_gg_kwh" -- so both forecast types are captured
   without needing a schema change.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

import pandas as pd

from src.predict import Forecaster

logger = logging.getLogger("replay_engine")


class RowSink(Protocol):
    """Anything that can accept rows for a named table. Real implementation
    talks to Supabase; DryRunSink (below) just logs, so this engine is fully
    testable without live credentials."""

    def write(self, table: str, rows: list[dict]) -> None: ...


class DryRunSink:
    """Collects rows in memory and logs counts instead of hitting Supabase.
    Use this to validate the replay logic before wiring in real credentials."""

    def __init__(self):
        self.written: dict[str, list[dict]] = {}

    def write(self, table: str, rows: list[dict]) -> None:
        if not rows:
            return
        self.written.setdefault(table, []).extend(rows)
        logger.info("[dry-run] would write %d rows to '%s'", len(rows), table)


class SupabaseSink:
    """Real sink -- writes to Supabase via the service role key. Only
    imports the supabase client when actually instantiated, so DryRunSink
    users don't need the dependency configured."""

    def __init__(self, url: str, service_role_key: str):
        from supabase import create_client
        self.client = create_client(url, service_role_key)

    def write(self, table: str, rows: list[dict]) -> None:
        if not rows:
            return
        self.client.table(table).insert(rows).execute()


@dataclass
class ReplayEngine:
    data: pd.DataFrame           # cleaned Ausgrid data, must include net_load_kwh
    models_dir: Path
    sink: RowSink
    start_time: pd.Timestamp
    tick_delta: pd.Timedelta = field(default_factory=lambda: pd.Timedelta(minutes=30))

    def __post_init__(self):
        self.current_time = self.start_time
        self._forecaster = Forecaster(self.models_dir)
        # Index once for fast per-tick lookups instead of filtering 15M rows every tick
        self._by_time = self.data.set_index("timestamp").sort_index()
        self.household_ids = sorted(int(h) for h in self.data["household_id"].unique())
        logger.info(
            "ReplayEngine ready: %d households, starting at %s, tick=%s",
            len(self.household_ids), self.start_time, self.tick_delta,
        )

    def _rows_at(self, ts: pd.Timestamp) -> pd.DataFrame:
        if ts not in self._by_time.index:
            return pd.DataFrame()
        rows = self._by_time.loc[[ts]]
        return rows[rows["household_id"].isin(self.household_ids)]

    def tick(self) -> dict:
        """Advance one half-hour, write consumption + forecast + grid_status
        rows, return a summary dict (useful for the /replay/status endpoint
        and for tests)."""
        ts = self.current_time
        current_rows = self._rows_at(ts)

        if current_rows.empty:
            logger.warning("No data at %s (reached end of replay window?)", ts)
            return {"timestamp": str(ts), "households": 0, "note": "no data at this timestamp"}

        # 1. consumption_readings -- matches new schema columns
        consumption_rows = [
            {
                "household_id": int(r.household_id),
                "ts": ts.isoformat(),
                "gc_kwh": float(r.gc_kwh),
                "cl_kwh": float(r.cl_kwh),
                "gg_kwh": float(r.gg_kwh),
                "net_kwh": float(r.net_load_kwh) if hasattr(r, 'net_load_kwh') else float(r.net_kwh),
                "source": "simulated",
            }
            for r in current_rows.itertuples()
        ]
        self.sink.write("consumption_readings", consumption_rows)

        # 2. grid_status -- gross figures, computed from the actual tick data
        total_demand = float((current_rows["gc_kwh"] + current_rows["cl_kwh"]).sum())
        total_supply = float(current_rows["gg_kwh"].sum())
        grid_status_row = {
            "ts": ts.isoformat(),
            "total_demand": total_demand,
            "total_supply": total_supply,
            "peak_flag": total_demand > (2.0 * len(self.household_ids)),  # crude threshold, tune after seeing real data
        }
        self.sink.write("grid_status", [grid_status_row])

        # 3. forecasts -- predict the NEXT tick for each household, both targets.
        # Bound the lookback window to comfortably cover the largest lag
        # (336 half-hours = 7 days) instead of slicing from the dataset's
        # start every tick -- that slice would only grow and slow down over
        # a long-running replay for no benefit, since predict() only uses
        # each household's most recent rows anyway.
        window_start = ts - pd.Timedelta(days=10)
        recent_window = self._by_time.loc[window_start:ts]
        recent_window = recent_window[recent_window["household_id"].isin(self.household_ids)].reset_index()

        forecast_rows = []
        for target in ("net_load_kwh", "gg_kwh"):
            try:
                preds = self._forecaster.predict(recent_window, target=target)
            except FileNotFoundError as e:
                logger.warning("Skipping forecasts for %s: %s", target, e)
                continue
            for r in preds.itertuples():
                forecast_row = {
                    "household_id": int(r.household_id),
                    "ts": pd.Timestamp(r.timestamp).isoformat(),
                    "model_used": r.model_used,
                }
                if target == "net_load_kwh":
                    forecast_row["predicted_consumption_kwh"] = float(r.predicted_kwh)
                else:
                    forecast_row["predicted_generation_kwh"] = float(r.predicted_kwh)
                forecast_rows.append(forecast_row)
        self.sink.write("forecasts", forecast_rows)

        self.current_time = ts + self.tick_delta

        return {
            "timestamp": ts.isoformat(),
            "households": len(current_rows),
            "total_demand": total_demand,
            "total_supply": total_supply,
            "forecasts_written": len(forecast_rows),
        }