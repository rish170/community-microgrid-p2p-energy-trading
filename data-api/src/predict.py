"""
predict.py
----------
Loads the trained XGBoost models from train_forecast.py and produces
predictions in the exact shape of the shared Supabase `forecasts` table:

    household_id, timestamp, predicted_kwh, model_used

This is the function your live replay API (the next phase) calls every
simulated tick -- it does NOT retrain anything, just loads saved models and
scores new rows.

Usage as a library:
    from predict import Forecaster
    f = Forecaster(models_dir="./models")
    rows = f.predict(recent_df, target="net_load_kwh")   # -> DataFrame ready to insert into Supabase

Usage as a CLI (for a quick manual check):
    python predict.py --models ./models --data ./data/processed/ausgrid_clean_full.parquet --household-id 1
"""

import argparse
from pathlib import Path

import joblib
import pandas as pd

from src.train_forecast import add_calendar_features, add_lag_features, LAGS


class Forecaster:
    def __init__(self, models_dir: str | Path):
        self.models_dir = Path(models_dir)
        self._cache = {}

    def _load(self, target: str):
        if target not in self._cache:
            path = self.models_dir / f"xgboost_{target}.joblib"
            if not path.exists():
                raise FileNotFoundError(f"No trained model at {path} -- run train_forecast.py first")
            self._cache[target] = joblib.load(path)
        return self._cache[target]

    def predict(self, recent_df: pd.DataFrame, target: str) -> pd.DataFrame:
        """
        recent_df: must contain at least household_id, timestamp, and the
        raw target column (net_load_kwh or gg_kwh) with enough history per
        household to cover the largest lag (336 half-hours = 7 days).
        Returns one row per (household_id, timestamp) with a prediction for
        the NEXT half-hour after each household's latest timestamp.
        """
        import xgboost as xgb

        bundle = self._load(target)
        model, feature_cols = bundle["model"], bundle["feature_cols"]

        df = recent_df[["household_id", "timestamp", target]].copy()
        df = add_calendar_features(df)
        df = add_lag_features(df, target)

        # Keep only the latest row per household -- that's the one row whose
        # lag features let us forecast the NEXT tick.
        latest = df.sort_values("timestamp").groupby("household_id").tail(1).copy()
        latest = latest.dropna(subset=[f"{target}_lag_{lag}" for lag in LAGS])
        if latest.empty:
            return pd.DataFrame(columns=["household_id", "timestamp", "predicted_kwh", "model_used"])

        latest["household_id"] = latest["household_id"].astype("category")
        dmat = xgb.DMatrix(latest[feature_cols], enable_categorical=True)
        preds = model.predict(dmat)

        out = pd.DataFrame(
            {
                "household_id": latest["household_id"].astype(int).to_numpy(),
                "timestamp": latest["timestamp"].to_numpy() + pd.Timedelta(minutes=30),
                "predicted_kwh": preds,
                "model_used": f"xgboost_{target}",
            }
        )
        return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--models", type=Path, default=Path("./models"))
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--household-id", type=int, default=None, help="Limit to one household for a quick check")
    parser.add_argument("--target", default="net_load_kwh", choices=["net_load_kwh", "gg_kwh"])
    args = parser.parse_args()

    df = pd.read_parquet(args.data)
    df["net_load_kwh"] = df["gc_kwh"] + df["cl_kwh"]
    if args.household_id is not None:
        df = df[df["household_id"] == args.household_id]

    f = Forecaster(args.models)
    out = f.predict(df, target=args.target)
    print(out.to_string(index=False))


if __name__ == "__main__":
    main()