"""
clean_ausgrid.py
-----------------
Cleans and reshapes the Ausgrid "Solar home electricity data" (2010-2013)
into a tidy, half-hourly long-format table ready for forecasting and for
loading into Supabase.

Based on direct inspection of the actual files (not just the official docs):
  - Each yearly CSV has a junk title row on line 1 -> skip it.
  - Columns: Customer, Generator Capacity, Postcode, Consumption Category,
    date, then 48 half-hourly columns ('0:30' ... '0:00').
  - Consumption Category is one of:
        GC = General Consumption (household load, excludes solar & CL)
        CL = Controlled Load (off-peak circuit; only ~139/300 households have it)
        GG = Gross Generation (solar output)
  - IMPORTANT inconsistency found: the 2010-2011 file has NO "Row Quality"
    column (53 cols), but 2011-2012 and 2012-2013 DO have one (54 cols).
    In this archive copy, that column is 100% blank/NaN in both files where
    it exists, so it carries no usable signal here -> we drop it rather than
    filter on it. (If you're using a different copy of the dataset that DOES
    have populated Row Quality flags, treat 'NA' rows as estimated and decide
    whether to drop or keep them explicitly.)
  - No negative values and no NaNs were found in the half-hourly readings
    themselves on the 2010-11 file (script still defends against both anyway).
  - All 300 customers have GC and GG for all 365 days/year. Only 139 have CL.
  - ANOTHER inconsistency found: the 'date' column format is NOT the same
    across years. 2010-2011 uses 'D-Mon-YY' (e.g. '1-Jul-10'), while
    2011-2012 and 2012-2013 use 'D/MM/YYYY' (e.g. '1/07/2011'). A single
    fixed format string will crash (or worse, silently misparse) two of the
    three files -- this script tries both formats per file.
  - This dataset has NO non-solar households at half-hourly resolution (the
    "4,064 non-solar homes" Ausgrid mentions are only in the separate MONTHLY
    file, which is too coarse for tick-based replay). To get a mixed
    prosumer/consumer community from ONE consistent half-hourly source, this
    script randomly designates a fraction of the 300 households as
    "consumer-only" and zeroes their generation column. This is a modeling
    choice, not a data artifact -- document it as such in your report.

Performance note: an earlier version of this script used pandas.melt() to
go from wide (48 half-hour columns) to long format, and it got OOM-killed
on a half-hourly year of data -- melt() carries every id column (including
strings) across 48x as many rows before you get a chance to downcast
anything. This version reshapes with raw numpy arrays instead, which is
both much faster and uses a fraction of the memory. If you're running this
on a memory-constrained machine, process one year at a time (the --raw-dir
loop already does this) rather than loading all three years as wide frames
simultaneously.

Usage:
    python clean_ausgrid.py --raw-dir ./raw --out-dir ./data/processed
"""

import argparse
import gc
import sys
from pathlib import Path

import numpy as np
import pandas as pd

YEAR_FILES = [
    "Solar home 2010-2011.csv",
    "Solar home 2011-2012.csv",
    "Solar home 2012-2013.csv",
]

ID_COLS = ["Customer", "Generator Capacity", "Postcode", "Consumption Category", "date"]


def half_hour_offsets(half_hour_cols):
    """Ausgrid's '0:00' column is the LAST half hour of the day (23:30-00:00),
    i.e. it belongs to the following midnight, not the start of that date."""
    offsets = []
    for label in half_hour_cols:
        if label == "0:00":
            offsets.append(pd.Timedelta(days=1))
        else:
            h, m = label.split(":")
            offsets.append(pd.Timedelta(hours=int(h), minutes=int(m)))
    return np.array(offsets, dtype="timedelta64[ns]")


KNOWN_DATE_FORMATS = ["%d-%b-%y", "%d/%m/%Y"]


def parse_dates_robust(date_series: pd.Series) -> np.ndarray:
    """The three yearly files use two different date formats (see module
    docstring). Try each known format for the whole column; a format either
    matches every row in a file or none of them, since each yearly export
    was written by one process -- so the first format that parses cleanly
    wins, rather than mixing formats row by row."""
    last_error = None
    for fmt in KNOWN_DATE_FORMATS:
        try:
            return pd.to_datetime(date_series, format=fmt).to_numpy(dtype="datetime64[ns]")
        except ValueError as e:
            last_error = e
            continue
    raise ValueError(
        f"Could not parse dates with any known format {KNOWN_DATE_FORMATS}. "
        f"Sample value: {date_series.iloc[0]!r}. Original error: {last_error}"
    )


def load_and_reshape_year(path: Path) -> pd.DataFrame:
    """Read one yearly CSV and return it already in long format, built with
    vectorized numpy ops (no pandas.melt) to keep memory bounded."""
    df = pd.read_csv(path, skiprows=1, low_memory=False)

    if "Row Quality" in df.columns:
        df = df.drop(columns=["Row Quality"])
    df.columns = [c.strip() for c in df.columns]

    half_hour_cols = [c for c in df.columns if c not in ID_COLS]
    n_slots = len(half_hour_cols)

    # Parse/compact the id columns ONCE, before they get repeated 48x.
    customer = df["Customer"].to_numpy(dtype="int16")
    gen_cap = df["Generator Capacity"].to_numpy(dtype="float32")
    postcode = df["Postcode"].to_numpy(dtype="int32")
    category = df["Consumption Category"].astype("category")
    category_codes = category.cat.codes.to_numpy()
    category_labels = category.cat.categories.to_numpy()
    date_dt = parse_dates_robust(df["date"])

    values = df[half_hour_cols].to_numpy(dtype="float32")  # shape (n_rows, 48)
    offsets = half_hour_offsets(half_hour_cols)             # shape (48,)

    n_rows = len(df)
    timestamps = (date_dt[:, None] + offsets[None, :]).reshape(-1)   # (n_rows*48,)
    kwh_flat = values.reshape(-1)
    customer_flat = np.repeat(customer, n_slots)
    gen_cap_flat = np.repeat(gen_cap, n_slots)
    postcode_flat = np.repeat(postcode, n_slots)
    category_codes_flat = np.repeat(category_codes, n_slots)

    long_df = pd.DataFrame(
        {
            "Customer": customer_flat,
            "Generator Capacity": gen_cap_flat,
            "Postcode": postcode_flat,
            "Consumption Category": pd.Categorical.from_codes(category_codes_flat, category_labels),
            "timestamp": timestamps,
            "kwh": kwh_flat,
        }
    )
    return long_df


def pivot_one_year(long_df: pd.DataFrame) -> pd.DataFrame:
    """Pivot Consumption Category into gc_kwh/cl_kwh/gg_kwh columns for a
    SINGLE year's long_df. Doing this per year (instead of concatenating all
    three years of long-format rows first) keeps peak memory well below what
    a single combined 38M-row pivot_table needs."""
    before = len(long_df)
    long_df = long_df.drop_duplicates(subset=["Customer", "Consumption Category", "timestamp"])
    deduped = before - len(long_df)
    if deduped:
        print(f"    dropped {deduped} duplicate (customer, category, timestamp) rows")

    neg_count = (long_df["kwh"] < 0).sum()
    if neg_count:
        print(f"    clipping {neg_count} negative kWh readings to 0")
    long_df["kwh"] = long_df["kwh"].clip(lower=0).astype("float32")

    pivoted = long_df.pivot_table(
        index=["Customer", "timestamp"],
        columns="Consumption Category",
        values="kwh",
        aggfunc="first",
        observed=True,
    ).reset_index()
    pivoted.columns.name = None
    pivoted = pivoted.rename(columns={"GC": "gc_kwh", "CL": "cl_kwh", "GG": "gg_kwh"})

    pivoted["has_controlled_load"] = pivoted["cl_kwh"].notna() if "cl_kwh" in pivoted.columns else False
    for col in ("gc_kwh", "cl_kwh", "gg_kwh"):
        if col not in pivoted.columns:
            pivoted[col] = 0.0
        pivoted[col] = pivoted[col].fillna(0.0).astype("float32")

    meta = long_df.drop_duplicates("Customer")[["Customer", "Generator Capacity", "Postcode"]]
    pivoted = pivoted.merge(meta, on="Customer", how="left")
    return pivoted


def clean_and_reshape(raw_dir: Path) -> pd.DataFrame:
    year_frames = []
    for fname in YEAR_FILES:
        fpath = raw_dir / fname
        if not fpath.exists():
            print(f"  ! missing {fpath}, skipping", file=sys.stderr)
            continue
        print(f"  reading + reshaping {fname} ...")
        long_df = load_and_reshape_year(fpath)
        print(f"    pivoting {fname} ...")
        year_frames.append(pivot_one_year(long_df))
        del long_df

    combined = pd.concat(year_frames, ignore_index=True)
    del year_frames
    gc.collect()

    # A household could in principle appear in more than one year's file for
    # the same timestamp only at a year boundary overlap, which Ausgrid's
    # files don't have -- but dedupe defensively across the combined result too.
    before = len(combined)
    combined = combined.drop_duplicates(subset=["Customer", "timestamp"])
    if before - len(combined):
        print(f"  dropped {before - len(combined)} cross-year duplicate rows")

    return combined.sort_values(["Customer", "timestamp"]).reset_index(drop=True)


def assign_prosumer_consumer_roles(df: pd.DataFrame, consumer_fraction: float = 0.4, seed: int = 42) -> pd.DataFrame:
    """Designate a fraction of households as consumer-only by zeroing their
    generation column. See module docstring for why this is necessary.
    Mutates df in place (no full-frame copy) -- this table is ~16M rows by
    this point, and copying it just to add a column roughly doubles peak
    memory for no benefit here."""
    rng = np.random.default_rng(seed)
    customers = sorted(df["Customer"].unique())
    n_consumers = int(round(len(customers) * consumer_fraction))
    consumer_ids = set(rng.choice(customers, size=n_consumers, replace=False))

    is_consumer = df["Customer"].isin(consumer_ids)
    df["role"] = np.where(is_consumer, "consumer", "prosumer")
    df["role"] = df["role"].astype("category")
    df.loc[is_consumer, "gg_kwh"] = 0.0
    return df


def add_net_demand(df: pd.DataFrame) -> pd.DataFrame:
    """Mutates df in place -- see note above."""
    df["net_kwh"] = (df["gc_kwh"] + df["cl_kwh"] - df["gg_kwh"]).astype("float32")
    return df


def main():
    parser = argparse.ArgumentParser(description="Clean the Ausgrid solar home dataset")
    parser.add_argument("--raw-dir", type=Path, default=Path("./raw"))
    parser.add_argument("--out-dir", type=Path, default=Path("./data/processed"))
    parser.add_argument("--consumer-fraction", type=float, default=0.4)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--sim-households", type=int, default=30,
                         help="Size of the smaller subset saved separately for the live replay demo")
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)

    print("Reading and reshaping yearly files...")
    df = clean_and_reshape(args.raw_dir)
    print(f"  -> {len(df):,} half-hourly household readings after reshape")

    print("Assigning prosumer/consumer roles...")
    df = assign_prosumer_consumer_roles(df, args.consumer_fraction, args.seed)
    n_prosumers = (df.groupby("Customer")["role"].first() == "prosumer").sum()
    n_consumers = (df.groupby("Customer")["role"].first() == "consumer").sum()
    print(f"  -> {n_prosumers} prosumers, {n_consumers} consumer-only households")

    df = add_net_demand(df)
    df = df.rename(columns={"Customer": "household_id"})

    full_path = args.out_dir / "ausgrid_clean_full.parquet"
    df.to_parquet(full_path, index=False)
    print(f"Saved full cleaned dataset -> {full_path} ({full_path.stat().st_size / 1e6:.1f} MB)")

    rng = np.random.default_rng(args.seed)
    prosumer_ids = df.loc[df["role"] == "prosumer", "household_id"].unique()
    consumer_ids = df.loc[df["role"] == "consumer", "household_id"].unique()
    n_p = int(round(args.sim_households * 0.6))
    n_c = args.sim_households - n_p
    sim_ids = list(rng.choice(prosumer_ids, size=min(n_p, len(prosumer_ids)), replace=False)) + \
              list(rng.choice(consumer_ids, size=min(n_c, len(consumer_ids)), replace=False))

    sim_df = df[df["household_id"].isin(sim_ids)].copy()
    sim_path = args.out_dir / "ausgrid_sim_subset.csv"
    sim_df.to_csv(sim_path, index=False)
    print(f"Saved {len(sim_ids)}-household demo subset -> {sim_path}")

    report_path = args.out_dir / "cleaning_report.txt"
    with open(report_path, "w") as f:
        f.write("Ausgrid dataset cleaning report\n")
        f.write("================================\n")
        f.write(f"Total households: {df['household_id'].nunique()}\n")
        f.write(f"Prosumers: {n_prosumers}  Consumer-only: {n_consumers}\n")
        f.write(f"Households with a Controlled Load circuit: {int(df.groupby('household_id')['has_controlled_load'].first().sum())}\n")
        f.write(f"Date range: {df['timestamp'].min()} to {df['timestamp'].max()}\n")
        f.write(f"Total readings: {len(df):,}\n")
        f.write(f"Demo subset size: {len(sim_ids)} households ({n_p} prosumer / {n_c} consumer)\n")
        f.write("\nKnown caveats (documented, not silently fixed):\n")
        f.write("- 'Row Quality' column was inconsistent across yearly files and\n")
        f.write("  fully blank where present in this archive -- dropped, not used to filter rows.\n")
        f.write("- 'date' column format differs across yearly files (D-Mon-YY in\n")
        f.write("  2010-2011 vs D/MM/YYYY in 2011-2012 and 2012-2013) -- handled by trying\n")
        f.write("  both known formats per file rather than assuming one format globally.\n")
        f.write("- DST transition days (~2/year) are not individually corrected; the\n")
        f.write("  dataset always carries 48 half-hour columns per day regardless of DST,\n")
        f.write("  so a couple of slots per year are off by an hour of wall-clock time.\n")
        f.write("  Not material at this project's resolution, but worth a one-line\n")
        f.write("  mention in your report's limitations section.\n")
        f.write("- Consumer-only role assignment is synthetic (see script docstring),\n")
        f.write("  since no household in this dataset is naturally non-solar at\n")
        f.write("  half-hourly resolution.\n")
    print(f"Wrote cleaning report -> {report_path}")


if __name__ == "__main__":
    main()
