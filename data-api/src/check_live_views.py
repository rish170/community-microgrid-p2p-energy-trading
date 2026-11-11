"""
check_live_views.py
-------------------
Read-only validation script to test that Supabase views:
  - v_live_households
  - v_live_consumption
  - v_live_actual_vs_predicted
conform to the Live Views Contract required by Power BI.

Usage:
  python -m src.check_live_views
  python -m src.check_live_views --help
  python -m src.check_live_views --url <SUPABASE_URL> --key <SERVICE_KEY> --api-url http://localhost:8000
"""

import argparse
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv()


def fetch_all_rows(client: Any, table_or_view: str, select: str = "*", page_size: int = 1000) -> list[dict]:
    """Fetch all rows from a PostgREST table or view, paginating beyond the 1000-row limit."""
    all_rows = []
    start = 0
    while True:
        res = client.table(table_or_view).select(select).range(start, start + page_size - 1).execute()
        rows = res.data or []
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        start += page_size
    return all_rows


def parse_ts(val: str | datetime) -> datetime:
    if isinstance(val, datetime):
        return val
    # Remove trailing Z or parse standard ISO formats
    clean_val = val.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(clean_val)
    except Exception:
        # Fallback for pandas/iso format variations
        return datetime.strptime(val[:19], "%Y-%m-%dT%H:%M:%S")


def format_table(rows: list[dict], headers: list[tuple[str, str, int]]) -> str:
    """Format rows as a neat ASCII table."""
    header_line = " | ".join(title.ljust(width) for _, title, width in headers)
    sep_line = "-+-".join("-" * width for _, _, width in headers)
    out = [header_line, sep_line]
    for r in rows:
        line_parts = []
        for key, _, width in headers:
            val = str(r.get(key, ""))
            if len(val) > width:
                val = val[: width - 3] + "..."
            line_parts.append(val.ljust(width))
        out.append(" | ".join(line_parts))
    return "\n".join(out)


def main():
    parser = argparse.ArgumentParser(
        description="Verify Supabase live views (v_live_households, v_live_consumption, v_live_actual_vs_predicted)"
    )
    parser.add_argument(
        "--url",
        default=os.environ.get("SUPABASE_URL"),
        help="Supabase Project URL (default: SUPABASE_URL env var)",
    )
    parser.add_argument(
        "--key",
        default=os.environ.get("SUPABASE_SERVICE_ROLE_KEY"),
        help="Supabase Service Role Key (default: SUPABASE_SERVICE_ROLE_KEY env var)",
    )
    parser.add_argument(
        "--api-url",
        default=os.environ.get("DATA_API_URL", "http://localhost:8000"),
        help="Base URL of running data-api for status check (default: http://localhost:8000)",
    )
    args = parser.parse_args()

    if not args.url or not args.key:
        print("\n[INFO] Missing Supabase credentials.")
        print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env or pass via --url and --key.")
        print("Run with --help for available options.\n")
        sys.exit(0)

    try:
        from supabase import create_client
        client = create_client(args.url, args.key)
    except ImportError:
        print("[FAIL] 'supabase' package is not installed. Install requirements first.")
        sys.exit(1)
    except Exception as e:
        print(f"[FAIL] Failed to initialize Supabase client: {e}")
        sys.exit(1)

    print("\n" + "=" * 70)
    print("LIVE VIEWS COMPATIBILITY CHECKLIST (Power BI DirectQuery)")
    print("=" * 70)

    all_passed = True

    # -------------------------------------------------------------------------
    # 1. v_live_households
    # -------------------------------------------------------------------------
    print("\n[1] Checking 'v_live_households'...")
    try:
        hh_rows = fetch_all_rows(client, "v_live_households")
        print(f"    Total rows returned: {len(hh_rows)}")

        if len(hh_rows) == 12:
            print("    [PASS] Exactly 12 live households present.")
        else:
            print(f"    [FAIL] Expected exactly 12 live households, found {len(hh_rows)}.")
            all_passed = False

        prosumers = [h for h in hh_rows if h.get("role") == "prosumer"]
        consumers = [h for h in hh_rows if h.get("role") == "consumer"]
        if len(prosumers) == 6 and len(consumers) == 6:
            print(f"    [PASS] Balanced split: {len(prosumers)} prosumers and {len(consumers)} consumers.")
        else:
            print(f"    [FAIL] Expected 6 prosumers and 6 consumers (got {len(prosumers)} P, {len(consumers)} C).")
            all_passed = False

        # Metadata validation
        invalid_caps = []
        null_zones = []
        null_wallets = []
        for h in hh_rows:
            hid = h.get("household_id")
            role = h.get("role")
            cap = float(h.get("generator_capacity_kw") or 0.0)
            if role == "prosumer" and cap <= 0.0:
                invalid_caps.append((hid, cap, "prosumer capacity <= 0"))
            if role == "consumer" and cap != 0.0:
                invalid_caps.append((hid, cap, "consumer capacity != 0"))
            if h.get("zone_id") is None:
                null_zones.append(hid)
            if not h.get("wallet_address"):
                null_wallets.append(hid)

        if not invalid_caps:
            print("    [PASS] Capacities valid: prosumer > 0 kW, consumer == 0.00 kW.")
        else:
            print(f"    [FAIL] Invalid capacities: {invalid_caps}")
            all_passed = False

        if not null_zones:
            print("    [PASS] zone_id is present on all households.")
        else:
            print(f"    [FAIL] Null zone_id found on households: {null_zones}")
            all_passed = False

        if not null_wallets:
            print("    [PASS] wallet_address is present on all households.")
        else:
            print(f"    [FAIL] Null or blank wallet_address on households: {null_wallets}")
            all_passed = False

        # Zone distribution check (warning only)
        unique_zones = {h.get("zone_id") for h in hh_rows}
        if len(unique_zones) == 1:
            print(f"    [WARN] All 12 households currently share zone_id = {list(unique_zones)[0]}.")
        else:
            print(f"    [INFO] Households distributed across {len(unique_zones)} zones: {sorted(unique_zones)}")

        # Print ASCII Table
        headers = [
            ("household_id", "ID", 6),
            ("role", "Role", 10),
            ("generator_capacity_kw", "Cap (kW)", 10),
            ("zone_id", "Zone", 6),
            ("postcode", "Postcode", 8),
            ("wallet_address", "Wallet Address", 44),
        ]
        print("\n" + format_table(sorted(hh_rows, key=lambda x: int(x.get("household_id", 0))), headers) + "\n")

    except Exception as e:
        print(f"    [FAIL] Error querying 'v_live_households': {e}")
        all_passed = False

    # -------------------------------------------------------------------------
    # 2. v_live_consumption
    # -------------------------------------------------------------------------
    print("[2] Checking 'v_live_consumption'...")
    cons_rows = []
    try:
        cons_rows = fetch_all_rows(client, "v_live_consumption")
        print(f"    Total rows returned: {len(cons_rows)}")

        if not cons_rows:
            print("    [INFO] View returned 0 rows (table empty or no 'simulated' rows yet).")
        else:
            distinct_houses = sorted({int(r["household_id"]) for r in cons_rows if "household_id" in r})
            print(f"    [INFO] Distinct households reporting: {len(distinct_houses)} ({distinct_houses})")

            # Parse timestamps
            parsed_dates = [parse_ts(r["ts"]) for r in cons_rows if "ts" in r]
            min_ts = min(parsed_dates)
            max_ts = max(parsed_dates)
            span = max_ts - min_ts
            print(f"    [INFO] Timestamp range: {min_ts.isoformat()} to {max_ts.isoformat()} (span: {span})")

            # Span check: <= 2 days + 1 hour margin
            if span <= timedelta(days=2, hours=1):
                print(f"    [PASS] Time span <= 2 days ({span}).")
            else:
                print(f"    [FAIL] Time span exceeds 2 days: {span} (view filter issue).")
                all_passed = False

            # Duplicate check
            keys = [(r["household_id"], r["ts"]) for r in cons_rows]
            dupes = len(keys) - len(set(keys))
            if dupes == 0:
                print("    [PASS] No duplicate (household_id, ts) pairs found.")
            else:
                print(f"    [FAIL] Found {dupes} duplicate (household_id, ts) rows!")
                all_passed = False

            # Null check on gc/cl/gg
            null_metrics = [
                r for r in cons_rows
                if r.get("gc_kwh") is None or r.get("cl_kwh") is None or r.get("gg_kwh") is None
            ]
            if not null_metrics:
                print("    [PASS] No null values in gc_kwh, cl_kwh, or gg_kwh.")
            else:
                print(f"    [FAIL] Found {len(null_metrics)} rows with null consumption metrics!")
                all_passed = False

    except Exception as e:
        print(f"    [FAIL] Error querying 'v_live_consumption': {e}")
        all_passed = False

    # -------------------------------------------------------------------------
    # 3. v_live_actual_vs_predicted
    # -------------------------------------------------------------------------
    print("\n[3] Checking 'v_live_actual_vs_predicted'...")
    try:
        act_rows = fetch_all_rows(client, "v_live_actual_vs_predicted")
        print(f"    Total rows returned: {len(act_rows)}")

        if not act_rows:
            if not cons_rows:
                print("    [INFO] View returned 0 rows (as expected when no consumption rows exist).")
            else:
                print("    [WARN] View returned 0 rows despite consumption rows existing (forecast partner missing).")
        else:
            # Partner share
            share = (len(act_rows) / len(cons_rows)) * 100.0 if cons_rows else 0.0
            print(f"    [INFO] Forecast match share: {len(act_rows)}/{len(cons_rows)} ({share:.1f}%)")
            # The first tick lacks a forecast partner; subsequent ticks should match ~100%
            if share >= 90.0 or len(cons_rows) <= 12:
                print(f"    [PASS] Forecast partner coverage acceptable ({share:.1f}%).")
            else:
                print(f"    [WARN] Low partner coverage ({share:.1f}%). Replay may have restarted or missed ticks.")

            # Null & negative checks
            null_preds = []
            neg_preds = []
            off_grid_ts = []
            for r in act_rows:
                c_pred = r.get("predicted_consumption_kwh")
                g_pred = r.get("predicted_generation_kwh")
                if c_pred is None or g_pred is None:
                    null_preds.append(r)
                else:
                    if float(c_pred) < 0 or float(g_pred) < 0:
                        neg_preds.append(r)
                
                # Timestamp interval check (:00 or :30)
                dt = parse_ts(r["ts"])
                if dt.minute not in (0, 30) or dt.second != 0:
                    off_grid_ts.append(r["ts"])

            if not null_preds:
                print("    [PASS] No nulls in predicted_consumption_kwh or predicted_generation_kwh.")
            else:
                print(f"    [FAIL] Found {len(null_preds)} rows with null predictions!")
                all_passed = False

            if not neg_preds:
                print("    [PASS] No negative predictions (all values >= 0.0).")
            else:
                print(f"    [FAIL] Found {len(neg_preds)} rows with negative prediction values!")
                all_passed = False

            if not off_grid_ts:
                print("    [PASS] All timestamps are strictly half-hourly (:00 or :30).")
            else:
                print(f"    [FAIL] Found {len(off_grid_ts)} timestamps not aligned to half-hour marks!")
                all_passed = False

    except Exception as e:
        print(f"    [FAIL] Error querying 'v_live_actual_vs_predicted': {e}")
        all_passed = False

    # -------------------------------------------------------------------------
    # 4. Replay API Status Sync (Optional)
    # -------------------------------------------------------------------------
    print("\n[4] Checking Data API Replay Status (Optional)...")
    try:
        import urllib.request
        import json
        req = urllib.request.Request(f"{args.api_url}/replay/status", headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode())
                print(f"    [INFO] Replay API is reachable at {args.api_url}")
                print(f"    [INFO] Engine Running: {data.get('running')}, Current Sim Time: {data.get('current_sim_time')}")
                if "ids_match" in data:
                    if data["ids_match"] is True:
                        print("    [PASS] API ID Guard: Engine households match Supabase in_live_sim households.")
                    elif data["ids_match"] is False:
                        print("    [WARN] API ID Guard reports a household ID divergence!")
    except Exception as e:
        print(f"    [INFO] Could not contact running API at {args.api_url} ({e}) - skipping clock sync.")

    print("\n" + "=" * 70)
    if all_passed:
        print("[RESULT] ALL LIVE VIEW CONTRACT CHECKS PASSED.")
    else:
        print("[RESULT] ONE OR MORE LIVE VIEW CONTRACT CHECKS FAILED.")
    print("=" * 70 + "\n")

    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
