"""
main.py
-------
FastAPI service wrapping ReplayEngine. Start/stop the simulated replay, check
status, reset the live data, or ask for an outage-backup estimate.

Environment variables (put these in a .env file, never commit it):
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
    DATA_PATH               (default: ./data/processed/ausgrid_clean_full.parquet)
    SIM_SUBSET_PATH         (default: ./data/processed/ausgrid_sim_subset.csv)
    MODELS_DIR              (default: ./models)
    REPLAY_START            (default: 2012-07-01T00:30:00 -- start of the model's test period)
    REPLAY_END              (default: REPLAY_START + 7 days -- replay stops here)
    LIVE_HOUSEHOLD_IDS      (optional, e.g. "282,33,212,..." -- overrides the automatic 6+6 pick)
    ALLOWED_ORIGINS         (default: * -- comma separated list of websites allowed to call this API)

Live houses (default): the 6 solar houses with the biggest panels plus the 6
non-solar houses with the lowest ids, picked from the 30-house sim subset. The
Supabase SQL (households.in_live_sim) uses the SAME rule, so they always match.

If SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set, this falls back to
DryRunSink and only logs what it WOULD write.

Run (from the data-api folder, so that "src" is importable):
    uvicorn main:app --port 8000
(--reload restarts the app, and the replay with it, on every file save.)
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.replay_engine import ReplayEngine, DryRunSink, SupabaseSink

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

engine: ReplayEngine | None = None
_replay_task: asyncio.Task | None = None
_stop_event: asyncio.Event | None = None
_running = False


def pick_live_households(sim_subset_path: Path) -> list[int]:
    override = os.environ.get("LIVE_HOUSEHOLD_IDS")
    if override:
        return [int(x) for x in override.split(",") if x.strip()]
    sub = pd.read_csv(sim_subset_path).drop_duplicates("household_id")
    solar = sub[sub["role"] == "prosumer"].nlargest(6, "Generator Capacity")["household_id"].tolist()
    non_solar = sub[sub["role"] == "consumer"].nsmallest(6, "household_id")["household_id"].tolist()
    return [int(x) for x in solar + non_solar]


def load_live_data(data_path: Path, live_ids: list[int]):
    # The model was trained with ALL household ids as categories, so keep the full list.
    all_ids = sorted(int(h) for h in pd.read_parquet(data_path, columns=["household_id"])["household_id"].unique())
    try:
        df = pd.read_parquet(data_path, filters=[("household_id", "in", live_ids)])
    except Exception:
        logger.warning("Filtered parquet read failed - falling back to reading the whole file")
        df = pd.read_parquet(data_path)
        df = df[df["household_id"].isin(live_ids)]
    df = df.copy()
    df["net_load_kwh"] = df["gc_kwh"] + df["cl_kwh"]
    return df, all_ids


def build_engine() -> ReplayEngine:
    data_path = Path(os.environ.get("DATA_PATH", "./data/processed/ausgrid_clean_full.parquet"))
    sim_subset_path = Path(os.environ.get("SIM_SUBSET_PATH", "./data/processed/ausgrid_sim_subset.csv"))
    models_dir = Path(os.environ.get("MODELS_DIR", "./models"))
    start_time = pd.Timestamp(os.environ.get("REPLAY_START", "2012-07-01T00:30:00"))
    end_env = os.environ.get("REPLAY_END")
    end_time = pd.Timestamp(end_env) if end_env else start_time + pd.Timedelta(days=7)

    live_ids = pick_live_households(sim_subset_path)
    logger.info("Live households (%d): %s", len(live_ids), live_ids)
    df_live, all_ids = load_live_data(data_path, live_ids)

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if supabase_url and supabase_key:
        logger.info("Using SupabaseSink (real writes to %s)", supabase_url)
        sink = SupabaseSink(supabase_url, supabase_key)
    else:
        logger.warning("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set -- using DryRunSink (logs only)")
        sink = DryRunSink()

    return ReplayEngine(
        data=df_live, models_dir=models_dir, sink=sink,
        start_time=start_time, end_time=end_time, household_categories=all_ids,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    engine = build_engine()
    yield
    if _stop_event is not None:
        _stop_event.set()


app = FastAPI(title="Community Microgrid - Data API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _replay_loop(interval_seconds: float):
    global _running
    try:
        while not _stop_event.is_set():
            try:
                # Run the tick in a worker thread so the API stays responsive during Supabase calls.
                summary = await asyncio.to_thread(engine.tick)
            except Exception:
                # A failed tick doesn't advance the clock, so the same tick is retried next beat
                # (safe, because writes are upserts).
                logger.exception("Tick failed - will retry on the next beat")
                summary = {}
            if summary.get("finished"):
                logger.info("Replay window finished - stopping")
                break
            try:
                await asyncio.wait_for(_stop_event.wait(), timeout=interval_seconds)
            except asyncio.TimeoutError:
                pass
    finally:
        _running = False


class StartRequest(BaseModel):
    tick_interval_seconds: float = Field(5.0, gt=0)


@app.post("/replay/start")
async def start_replay(req: StartRequest = StartRequest()):
    global _replay_task, _stop_event, _running
    if _running:
        raise HTTPException(status_code=409, detail="Replay already running")
    if engine.finished:
        raise HTTPException(status_code=409, detail="Replay window finished - call /replay/reset first")
    _stop_event = asyncio.Event()
    _running = True
    _replay_task = asyncio.create_task(_replay_loop(req.tick_interval_seconds))
    return {"status": "started", "tick_interval_seconds": req.tick_interval_seconds}


@app.post("/replay/stop")
async def stop_replay():
    if not _running or _replay_task is None:
        raise HTTPException(status_code=409, detail="Replay is not running")
    _stop_event.set()
    await _replay_task  # wait for the current tick to finish cleanly
    return {"status": "stopped", "current_sim_time": engine.current_time.isoformat()}


@app.post("/replay/reset")
def reset_replay():
    """Delete the live replay rows in Supabase and rewind to the start.
    households, trades and your seeded history are NOT touched."""
    if _running:
        raise HTTPException(status_code=409, detail="Stop the replay before resetting")
    engine.reset()
    return {"status": "reset", "current_sim_time": engine.current_time.isoformat()}


@app.post("/replay/tick")
def manual_tick():
    """Advance exactly one tick -- for debugging without starting the full loop."""
    if _running:
        raise HTTPException(status_code=409, detail="Stop the running loop before manual ticking")
    return engine.tick()


@app.get("/replay/status")
def status():
    return {
        "running": _running,
        "finished": engine.finished if engine else None,
        "current_sim_time": engine.current_time.isoformat() if engine else None,
        "end_time": engine.end_time.isoformat() if engine and engine.end_time is not None else None,
        "households": engine.household_ids if engine else [],
    }


@app.get("/backup/estimate")
def backup_estimate(hours: float = Query(4.0, gt=0, le=12)):
    """Outage-backup estimate for the next `hours` hours (see ReplayEngine.estimate_backup)."""
    return engine.estimate_backup(hours)


@app.get("/health")
def health():
    return {"status": "ok"}