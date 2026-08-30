"""
train_forecast.py
------------------
Phase 2: demand + generation forecasting on the cleaned Ausgrid dataset.

Trains TWO separate targets, since they behave nothing alike:
  - net_load_kwh   = gc_kwh + cl_kwh   (household consumption -- human routine driven)
  - gg_kwh         = solar generation  (weather/daylight driven)

Design choices (documented here so they're easy to defend in your report):
  - ONE pooled XGBoost model per target, with household_id as a categorical
    feature, instead of 300 separate per-household models. Pooling lets the
    model share patterns across households and is what you'd actually train
    once and call repeatedly from a live replay API -- 300 individual models
    would also take far too long to train on a laptop.
  - Prophet is fit on a SINGLE representative household only (not all 300)
    as a baseline comparison point for your report's model-comparison
    section. Prophet is comparatively slow to fit and doesn't take extra
    features easily, so it's not the production model -- XGBoost is.
  - Train/test split is TIME-BASED (year 1+2 = train, year 3 = test), never
    a random shuffle, since a random split would leak future half-hours into
    training and make accuracy look better than it really is.
  - No weather data is available in this dataset -- generation forecasts
    are calendar+lag only, which caps their accuracy. This is a known,
    documented limitation, not a bug. Flag it explicitly in your report.

Usage:
    python train_forecast.py --data ./data/processed/ausgrid_clean_full.parquet --out ./models
"""

import argparse
import gc
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error
import xgboost as xgb

LAGS = [1, 48, 336]  # previous half-hour, same time yesterday, same time last week


def add_calendar_features(df: pd.DataFrame) -> pd.DataFrame:
    df["hour"] = df["timestamp"].dt.hour.astype("int8")
    df["half_hour_of_day"] = (df["timestamp"].dt.hour * 2 + (df["timestamp"].dt.minute // 30)).astype("int8")
    df["day_of_week"] = df["timestamp"].dt.dayofweek.astype("int8")
    df["is_weekend"] = (df["day_of_week"] >= 5).astype("int8")
    df["month"] = df["timestamp"].dt.month.astype("int8")
    return df


def add_lag_features(df: pd.DataFrame, target_col: str) -> pd.DataFrame:
    """Lags must be computed PER HOUSEHOLD, sorted by time, or you leak one
    household's history into another's lag features."""
    df = df.sort_values(["household_id", "timestamp"])
    grouped = df.groupby("household_id", observed=True)[target_col]
    for lag in LAGS:
        df[f"{target_col}_lag_{lag}"] = grouped.shift(lag).astype("float32")
    return df


def build_features(df: pd.DataFrame, target_col: str) -> pd.DataFrame:
    # Work on a slim frame with only the columns this target actually needs --
    # mutating in place from here on, no extra full-frame copies.
    df = df[["household_id", "timestamp", target_col]]
    df = add_calendar_features(df)
    df = add_lag_features(df, target_col)
    lag_cols = [f"{target_col}_lag_{lag}" for lag in LAGS]
    df = df.dropna(subset=lag_cols)
    return df


def time_split(df: pd.DataFrame):
    train = df[df["timestamp"] < "2012-07-01"]
    test = df[df["timestamp"] >= "2012-07-01"]
    return train, test


def train_xgboost(train: pd.DataFrame, test: pd.DataFrame, target_col: str, feature_cols: list):
    # QuantileDMatrix (paired with tree_method="hist") builds histogram bins
    # directly instead of materializing a full intermediate DMatrix first --
    # noticeably lighter on peak memory for large row counts than plain
    # xgb.DMatrix, at no cost to accuracy for the hist method.
    dtrain = xgb.QuantileDMatrix(train[feature_cols], label=train[target_col], enable_categorical=True)
    dtest = xgb.QuantileDMatrix(test[feature_cols], label=test[target_col], enable_categorical=True, ref=dtrain)

    params = {
        "objective": "reg:squarederror",
        "tree_method": "hist",
        "max_depth": 6,
        "eta": 0.1,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "eval_metric": "mae",
    }
    model = xgb.train(
        params,
        dtrain,
        num_boost_round=300,
        evals=[(dtrain, "train"), (dtest, "test")],
        early_stopping_rounds=20,
        verbose_eval=False,
    )
    preds = model.predict(dtest)
    mae = mean_absolute_error(test[target_col], preds)
    rmse = np.sqrt(mean_squared_error(test[target_col], preds))
    return model, {"mae": float(mae), "rmse": float(rmse), "best_iteration": int(model.best_iteration)}


def train_prophet_baseline(df: pd.DataFrame, target_col: str, sample_household_id: int):
    """Fit Prophet on ONE household only -- see module docstring for why."""
    from prophet import Prophet

    hh = df[df["household_id"] == sample_household_id][["timestamp", target_col]].copy()
    hh = hh.rename(columns={"timestamp": "ds", target_col: "y"})
    hh = hh.sort_values("ds")

    train = hh[hh["ds"] < "2012-07-01"]
    test = hh[hh["ds"] >= "2012-07-01"]

    m = Prophet(daily_seasonality=True, weekly_seasonality=True, yearly_seasonality=True)
    m.fit(train)

    future = test[["ds"]]
    forecast = m.predict(future)
    mae = mean_absolute_error(test["y"].to_numpy(), forecast["yhat"].to_numpy())
    rmse = np.sqrt(mean_squared_error(test["y"].to_numpy(), forecast["yhat"].to_numpy()))
    return m, {"mae": float(mae), "rmse": float(rmse), "household_id": int(sample_household_id)}


def run_for_target(df: pd.DataFrame, target_col: str, out_dir: Path, run_prophet: bool, prophet_household: int):
    print(f"\n=== Target: {target_col} ===")
    print("Building features...")
    feat_df = build_features(df, target_col)

    feature_cols = [
        "household_id", "hour", "half_hour_of_day", "day_of_week", "is_weekend", "month",
    ] + [f"{target_col}_lag_{lag}" for lag in LAGS]
    feat_df["household_id"] = feat_df["household_id"].astype("category")

    train, test = time_split(feat_df)
    train = train[feature_cols + [target_col]].copy()
    test = test[feature_cols + [target_col]].copy()
    del feat_df
    gc.collect()
    print(f"  train rows: {len(train):,}  test rows: {len(test):,}")

    print("Training XGBoost...")
    xgb_model, xgb_metrics = train_xgboost(train, test, target_col, feature_cols)
    print(f"  XGBoost -> MAE={xgb_metrics['mae']:.4f} kWh, RMSE={xgb_metrics['rmse']:.4f} kWh")
    del train, test
    gc.collect()

    xgb_path = out_dir / f"xgboost_{target_col}.joblib"
    joblib.dump({"model": xgb_model, "feature_cols": feature_cols, "target_col": target_col}, xgb_path)
    print(f"  saved -> {xgb_path}")

    results = {"target": target_col, "xgboost": xgb_metrics}

    if run_prophet:
        # Guard against picking a household whose target is trivially constant
        # for this target -- e.g. a synthetic "consumer-only" household has
        # gg_kwh = 0 for every single row (see clean_ausgrid.py), which would
        # make Prophet's error look like a perfect (fake) 0.0 rather than a
        # real forecast.
        hh_id = prophet_household
        hh_std = df.loc[df["household_id"] == hh_id, target_col].std()
        if not hh_std or hh_std == 0:
            candidates = df.groupby("household_id")[target_col].std()
            fallback = candidates[candidates > 0].index
            if len(fallback):
                hh_id = int(fallback[0])
                print(f"  household {prophet_household} has zero variance in {target_col} "
                      f"(likely a synthetic consumer-only household) -- using household {hh_id} instead")
        print(f"Training Prophet baseline on household {hh_id}...")
        try:
            prophet_model, prophet_metrics = train_prophet_baseline(df, target_col, hh_id)
            print(f"  Prophet -> MAE={prophet_metrics['mae']:.4f} kWh, RMSE={prophet_metrics['rmse']:.4f} kWh")
            results["prophet"] = prophet_metrics
        except ImportError:
            print("  ! prophet not installed, skipping baseline (pip install prophet)")

    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=Path("./data/processed/ausgrid_clean_full.parquet"))
    parser.add_argument("--out", type=Path, default=Path("./models"))
    parser.add_argument("--skip-prophet", action="store_true", help="Skip the Prophet baseline (faster)")
    parser.add_argument("--prophet-household", type=int, default=1)
    parser.add_argument("--sample-households", type=int, default=None,
                         help="Train on only N randomly chosen households -- useful for a fast first pass "
                              "on a memory-constrained machine before committing to a full run")
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)

    print(f"Loading {args.data} ...")
    df = pd.read_parquet(args.data)

    if args.sample_households:
        rng = np.random.default_rng(42)
        chosen = rng.choice(df["household_id"].unique(), size=args.sample_households, replace=False)
        df = df[df["household_id"].isin(chosen)].copy()
        print(f"  sampled down to {args.sample_households} households -> {len(df):,} rows")
        if args.prophet_household not in chosen:
            args.prophet_household = int(chosen[0])
            print(f"  --prophet-household wasn't in the sample; using household {args.prophet_household} instead")

    df["net_load_kwh"] = df["gc_kwh"] + df["cl_kwh"]

    all_results = {}
    for target_col in ["net_load_kwh", "gg_kwh"]:
        all_results[target_col] = run_for_target(
            df, target_col, args.out, run_prophet=not args.skip_prophet, prophet_household=args.prophet_household
        )
        gc.collect()

    metrics_path = args.out / "metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\nWrote metrics -> {metrics_path}")
    print(json.dumps(all_results, indent=2))


if __name__ == "__main__":
    main()