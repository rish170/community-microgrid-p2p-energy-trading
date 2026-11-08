"""
predict.py
----------
Loads the trained XGBoost models from train_forecast.py and produces
predictions for the shared Supabase `forecasts` table.

What changed in this version (and why):

1. OFF-BY-ONE FIX. The old predict() took each household's latest row and fed
   it to the model. That row's lag features describe the 30 minutes BEFORE
   it, so the model was really estimating the value of the row we already
   had -- but the result was stamped one tick later. The forecast line
   therefore lagged the real line by one half-hour. Now we append a brand-new
   "future" row for the next timestamp (target unknown) and build its
   features properly, exactly like the training data was built.

2. MULTI-STEP FORECASTS (predict_horizon). Needed for the outage-backup
   feature ("how much energy will this house need over the next X hours?").
   For step 2, 3, ... the previous prediction is fed back in as if it had
   really happened (recursive forecasting). Accuracy drops a little with every
   extra step, which is normal and worth one sentence in your report.

3. HOUSEHOLD CATEGORIES ARE PINNED. During training, household_id was turned
   into a categorical holding all 300 ids. At prediction time we rebuild it
   with the SAME full list and the same number type, even if we only score 12
   houses, so XGBoost can never mix up which house is which. Pass
   household_categories to Forecaster for that.

4. Predictions are clipped at 0 (energy used / generated can't be negative).

Usage as a library:
    from src.predict import Forecaster
    f = Forecaster("./models", household_categories=all_ids)
    next_tick = f.predict(recent_df, target="net_load_kwh")
    next_4h   = f.predict_horizon(recent_df, "net_load_kwh", steps=8)

Usage as a CLI (quick manual check):
    python -m src.predict --models ./models --data ./data/processed/ausgrid_clean_full.parquet --household-id 1 --steps 4
"""

import argparse
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from src.train_forecast import add_calendar_features, add_lag_features, LAGS

STEP = pd.Timedelta(minutes=30)
OUT_COLUMNS = ["household_id", "timestamp", "predicted_kwh", "model_used"]


class Forecaster:
    def __init__(self, models_dir: str | Path, household_categories: list[int] | None = None):
        self.models_dir = Path(models_dir)
        self.household_categories = household_categories
        self._cache = {}

    def _load(self, target: str):
        if target not in self._cache:
            path = self.models_dir / f"xgboost_{target}.joblib"
            if not path.exists():
                raise FileNotFoundError(f"No trained model at {path} -- run train_forecast.py first")
            self._cache[target] = joblib.load(path)
        return self._cache[target]

    def _household_codes(self, ids: pd.Series):
        """household_id as a categorical that matches the training categories."""
        if self.household_categories is not None:
            # Same ids AND the same number type (e.g. int16) as at training time --
            # XGBoost refuses categories whose type differs from training.
            cats = pd.Index(self.household_categories).astype(ids.dtype)
            return pd.Categorical(ids, categories=cats)
        return ids.astype("category")

    def predict_horizon(self, recent_df: pd.DataFrame, target: str, steps: int = 1) -> pd.DataFrame:
        """
        recent_df: household_id, timestamp and the raw target column
        (net_load_kwh or gg_kwh), with enough history per household to cover
        the largest lag (336 half-hours = 7 days).

        Returns one row per (household, step) with:
            household_id, timestamp, step, predicted_kwh, model_used
        where step 1 = the next half-hour after each household's latest row.
        """
        import xgboost as xgb

        bundle = self._load(target)
        model, feature_cols = bundle["model"], bundle["feature_cols"]
        lag_cols = [f"{target}_lag_{lag}" for lag in LAGS]

        hist = recent_df[["household_id", "timestamp", target]].copy()
        hist = hist.sort_values(["household_id", "timestamp"]).reset_index(drop=True)
        last_ts = hist.groupby("household_id")["timestamp"].max()

        results = []
        for step in range(1, steps + 1):
            # A new row for the timestamp we want to predict; its target is unknown (NaN).
            future = pd.DataFrame(
                {
                    "household_id": last_ts.index.to_numpy(),
                    "timestamp": (last_ts + STEP * step).to_numpy(),
                    target: np.nan,
                }
            )
            combined = pd.concat([hist, future], ignore_index=True)
            combined = add_calendar_features(combined)
            combined = add_lag_features(combined, target)

            # Keep only the future rows, now carrying the right lag values.
            rows = combined.merge(future[["household_id", "timestamp"]], on=["household_id", "timestamp"])
            rows = rows.dropna(subset=lag_cols)
            if rows.empty:
                break

            X = rows[feature_cols].copy()
            X["household_id"] = self._household_codes(X["household_id"])
            preds = np.clip(model.predict(xgb.DMatrix(X, enable_categorical=True)), 0.0, None)

            step_df = rows[["household_id", "timestamp"]].copy()
            step_df[target] = preds
            # Feed this prediction back into the history so the next step can use it as a lag.
            hist = pd.concat([hist, step_df], ignore_index=True)

            out = step_df.rename(columns={target: "predicted_kwh"})
            out["step"] = step
            results.append(out)

        if not results:
            return pd.DataFrame(columns=OUT_COLUMNS + ["step"])

        out = pd.concat(results, ignore_index=True)
        out["household_id"] = out["household_id"].astype(int)
        out["model_used"] = f"xgboost_{target}"
        return out[["household_id", "timestamp", "step", "predicted_kwh", "model_used"]]

    def predict(self, recent_df: pd.DataFrame, target: str) -> pd.DataFrame:
        """Next half-hour only. Same output shape as before."""
        out = self.predict_horizon(recent_df, target, steps=1)
        if out.empty:
            return pd.DataFrame(columns=OUT_COLUMNS)
        return out[OUT_COLUMNS]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--models", type=Path, default=Path("./models"))
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--household-id", type=int, default=None, help="Limit to one household for a quick check")
    parser.add_argument("--target", default="net_load_kwh", choices=["net_load_kwh", "gg_kwh"])
    parser.add_argument("--steps", type=int, default=1, help="How many half-hours ahead")
    args = parser.parse_args()

    df = pd.read_parquet(args.data)
    df["net_load_kwh"] = df["gc_kwh"] + df["cl_kwh"]
    all_ids = sorted(int(h) for h in df["household_id"].unique())
    if args.household_id is not None:
        df = df[df["household_id"] == args.household_id]
    df = df[df["timestamp"] >= df["timestamp"].max() - pd.Timedelta(days=10)]

    f = Forecaster(args.models, household_categories=all_ids)
    print(f.predict_horizon(df, target=args.target, steps=args.steps).to_string(index=False))


if __name__ == "__main__":
    main()