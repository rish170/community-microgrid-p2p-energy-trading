"""
main.py
-------
FastAPI service wrapping ReplayEngine. This is what actually runs on
Laptop 2 and gets deployed -- start/stop the simulated replay, check status,
or manually step one tick at a time for debugging.

Environment variables (put these in a .env file, never commit it):
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
    DATA_PATH            (default: ./data/processed/ausgrid_clean_full.parquet)
    SIM_SUBSET_PATH       (default: ./data/processed/ausgrid_sim_subset.csv)
    MODELS_DIR             (default: ./models)
    REPLAY_START            (default: 2012-07-01T00:30:00 -- start of the model's test period)
    TICK_INTERVAL_SECONDS   (default: 2 -- real seconds between each simulated half-hour)

If SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set, this falls back to
DryRunSink automatically and just logs what it WOULD write -- useful for
local development before Supabase credentials are wired in.

Run:
    uvicorn main:app --reload --port 8000
"""

import asyncio
import logging
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from src.replay_engine import ReplayEngine, DryRunSink, SupabaseSink

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

app = FastAPI(title="Community Microgrid - Data API")

engine: ReplayEngine | None = None
_replay_task: asyncio.Task | None = None
_running = False


def build_engine() -> ReplayEngine:
    data_path = Path(os.environ.get("DATA_PATH", "./data/processed/ausgrid_clean_full.parquet"))
    sim_subset_path = Path(os.environ.get("SIM_SUBSET_PATH", "./data/processed/ausgrid_sim_subset.csv"))
    models_dir = Path(os.environ.get("MODELS_DIR", "./models"))
    start_time = pd.Timestamp(os.environ.get("REPLAY_START", "2012-07-01T00:30:00"))

    df = pd.read_parquet(data_path)
    df["net_load_kwh"] = df["gc_kwh"] + df["cl_kwh"]

    sim_ids = pd.read_csv(sim_subset_path)["household_id"].unique().tolist()
    df_sim = df[df["household_id"].isin(sim_ids)].copy()

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if supabase_url and supabase_key:
        logger.info("Using SupabaseSink (real writes to %s)", supabase_url)
        sink = SupabaseSink(supabase_url, supabase_key)
    else:
        logger.warning("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set -- using DryRunSink (logs only, no real writes)")
        sink = DryRunSink()

    return ReplayEngine(data=df_sim, models_dir=models_dir, sink=sink, start_time=start_time)


@app.on_event("startup")
def on_startup():
    global engine
    engine = build_engine()


async def _replay_loop(interval_seconds: float):
    global _running
    _running = True
    try:
        while _running:
            engine.tick()
            await asyncio.sleep(interval_seconds)
    except asyncio.CancelledError:
        pass
    finally:
        _running = False


class StartRequest(BaseModel):
    tick_interval_seconds: float = 2.0


@app.post("/replay/start")
async def start_replay(req: StartRequest):
    global _replay_task
    if _running:
        raise HTTPException(status_code=409, detail="Replay already running")
    _replay_task = asyncio.create_task(_replay_loop(req.tick_interval_seconds))
    return {"status": "started", "tick_interval_seconds": req.tick_interval_seconds}


@app.post("/replay/stop")
async def stop_replay():
    global _replay_task
    if not _running or _replay_task is None:
        raise HTTPException(status_code=409, detail="Replay is not running")
    _replay_task.cancel()
    return {"status": "stopped", "current_sim_time": engine.current_time.isoformat()}


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
        "current_sim_time": engine.current_time.isoformat() if engine else None,
        "households": engine.household_ids if engine else [],
    }


@app.get("/health")
def health():
    return {"status": "ok"}