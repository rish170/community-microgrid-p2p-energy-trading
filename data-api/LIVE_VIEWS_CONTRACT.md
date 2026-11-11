# Power BI Live Views & Data API Contract

This document specifies the strict compatibility contract between `/data-api` and the three Supabase database views read directly by Power BI (via DirectQuery with automatic page refresh every 5 seconds).

---

## 1. Immutable Contract Constants

The following values are hard dependencies for the database views and **must never be changed**:

| Constant | Value | Defined In | Reason |
| :--- | :--- | :--- | :--- |
| `SOURCE_TAG` | `"simulated"` | `src/replay_engine.py:47` | `v_live_consumption` specifically filters `WHERE source = 'simulated'`. |
| `model_used` | `"xgboost_v1"` | `src/replay_engine.py:225` | Stamped on each forecast record; required by schema constraint and reporting. |
| **12-ID Rule** | 6 Solar + 6 Non-Solar | `src/main.py:58` | Top 6 solar generators by capacity + lowest 6 non-solar consumer IDs. |

The 12 live IDs:
- **Prosumers (6):** `282, 33, 212, 55, 244, 112`
- **Consumers (6):** `18, 26, 48, 90, 117, 141`

---

## 2. The Three Live Views

```sql
-- 1. Active 12 households in the live simulation
create or replace view v_live_households as
select * from households where in_live_sim;

-- 2. Recent 2-day rolling window of simulated consumption readings
create or replace view v_live_consumption as
select id, household_id, ts, gc_kwh, cl_kwh, gg_kwh,
       (gc_kwh + cl_kwh - gg_kwh) as net_kwh, extract(hour from ts)::int as hour
from consumption_readings
where source = 'simulated'
  and ts >= (select max(ts) from consumption_readings where source = 'simulated') - interval '2 days';

-- 3. Inner join of actual readings with pre-computed forecast partner
create or replace view v_live_actual_vs_predicted as
select c.household_id, c.ts, c.net_kwh as actual_net_kwh,
       f.predicted_consumption_kwh - coalesce(f.predicted_generation_kwh, 0) as predicted_net_kwh,
       f.predicted_consumption_kwh, f.predicted_generation_kwh,
       c.gc_kwh + c.cl_kwh as actual_consumption_kwh, c.gg_kwh as actual_generation_kwh
from v_live_consumption c
join forecasts f on f.household_id = c.household_id and f.ts = c.ts;
```

---

## 3. The 10 Contract Invariants (C1 – C10)

- **C1:** Every live consumption row has `source = 'simulated'` (never altered).
- **C2:** The replayed houses are exactly the 12 IDs in `households WHERE in_live_sim = true`.
- **C3:** `forecasts`: one merged row per house per timestamp, `model_used = 'xgboost_v1'`, both predicted columns filled for all 12 houses, values $\ge 0$.
- **C4:** The forecast for timestamp $T$ is written **before** the actual reading for $T$ (one tick earlier), so the join in `v_live_actual_vs_predicted` immediately finds it.
- **C5:** `ts` values in `consumption_readings` and `forecasts` are formatted as timezone-naive ISO strings and parsed identically as UTC by Postgres `timestamptz`.
- **C6:** All writes are idempotent (`upsert` with conflict keys `household_id,ts` and `ts`). Restart, reset, or re-run cannot create duplicates.
- **C7:** Row volume stays bounded: at most 12 houses $\times$ 336 ticks ($4,032$ rows) per 7-day run.
- **C8:** Empty tables (after reset) or a finished replay return zero rows from all three views without SQL errors.
- **C9:** `/replay/reset` deletes only data-api-owned rows (`source = 'simulated'` on consumption, all rows on forecasts/grid_status) and leaves `households` and all website tables untouched.
- **C10:** Live house IDs in code and in Supabase are validated at startup via `fetch_live_household_ids()`, warning on divergence.

---

## 4. Known Behaviours

1. **Seeded Row Overwrite & Delete on Reset:** When a live tick upserts into `consumption_readings` at `(household_id, ts)`, if a historical seed row already existed at that exact timestamp, its values are updated and its `source` is changed to `'simulated'`. A subsequent `/replay/reset` deletes all rows where `source = 'simulated'`, thereby permanently removing that previously seeded row.
2. **Total Reset of Forecasts & Grid Status:** `reset()` wipes **all** rows in `forecasts` and `grid_status` (using `.neq("id", 0)`). This is because only `data-api` generates and writes to these two tables; no historical seed rows are preserved in them across a reset.
3. **Timezone Interpretation:** Naive ISO strings emitted by `ts.isoformat()` (e.g. `2012-07-01T00:30:00`) are ingested into PostgreSQL `timestamptz` columns and interpreted as UTC.
4. **First Replayed Tick Has No Forecast Partner:** At tick 1 ($T_1$), `consumption_readings` is written for $T_1$, and the first forecast is produced for $T_2$ ($T_1 + 30\text{min}$). Because no forecast was pre-computed for $T_1$, $T_1$ will not appear in `v_live_actual_vs_predicted`. Starting with tick 2 ($T_2$), all rows match $100\%$.
5. **Two-Day Rolling View Window:** `v_live_consumption` filters to the last 2 simulated days (`ts >= max(ts) - interval '2 days'`). When the replay is running, Power BI displays an active rolling 48-hour window.

---

## 5. Execution Order

Run components in this exact order:

```bash
# 1. Execute SQL Migration in Supabase SQL Editor:
# Run: supabase/migrations/20261111154600_v_live_views.sql

# 2. Start Data API service (from data-api folder):
uvicorn src.main:app --port 8000

# 3. Start the replay loop (or trigger a tick):
curl -X POST http://localhost:8000/replay/start -H "Content-Type: application/json" -d "{\"tick_interval_seconds\": 5.0}"

# 4. Verify views and contract compliance:
python -m src.check_live_views
```
