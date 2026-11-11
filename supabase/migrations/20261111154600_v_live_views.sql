-- Migration: 20261111154600_v_live_views.sql
-- Description: Idempotent migration creating constraints, indexes, and the three Power BI live views.
--              Also restores prosumer generator_capacity_kw values to match the Ausgrid dataset.
-- NOTE: Safe to re-run. Does not drop or truncate existing tables or data.

-- Ensure households table has in_live_sim column
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS in_live_sim BOOLEAN NOT NULL DEFAULT FALSE;

-- =========================================================================
-- 1. HOUSEHOLD DATA INTEGRITY (Restore generator_capacity_kw to dataset values)
-- =========================================================================
-- Restores generator capacities to the authentic Ausgrid dataset values.
-- Leaves role, in_live_sim, wallet_address, zone_id, postcode, and has_controlled_load untouched.
UPDATE public.households SET generator_capacity_kw = 3.00 WHERE household_id = 282;
UPDATE public.households SET generator_capacity_kw = 2.10 WHERE household_id = 33;
UPDATE public.households SET generator_capacity_kw = 2.10 WHERE household_id = 212;
UPDATE public.households SET generator_capacity_kw = 2.00 WHERE household_id = 55;
UPDATE public.households SET generator_capacity_kw = 2.00 WHERE household_id = 244;
UPDATE public.households SET generator_capacity_kw = 1.92 WHERE household_id = 112;
UPDATE public.households SET generator_capacity_kw = 0.00 WHERE household_id IN (18, 26, 48, 90, 117, 141);

-- =========================================================================
-- 2. UNIQUE CONSTRAINTS (Required by PostgREST upsert on_conflict)
-- =========================================================================
DO $$
BEGIN
    -- uq_cons on consumption_readings(household_id, ts)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_cons'
    ) THEN
        ALTER TABLE public.consumption_readings ADD CONSTRAINT uq_cons UNIQUE (household_id, ts);
    END IF;

    -- uq_fc on forecasts(household_id, ts)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_fc'
    ) THEN
        ALTER TABLE public.forecasts ADD CONSTRAINT uq_fc UNIQUE (household_id, ts);
    END IF;

    -- uq_grid on grid_status(ts)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_grid'
    ) THEN
        ALTER TABLE public.grid_status ADD CONSTRAINT uq_grid UNIQUE (ts);
    END IF;
END $$;

-- =========================================================================
-- 3. INDEXES FOR LIVE PERFORMANCE
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_cons_ts ON public.consumption_readings (ts);
CREATE INDEX IF NOT EXISTS idx_cons_sim_ts ON public.consumption_readings (ts) WHERE source = 'simulated';

-- =========================================================================
-- 4. LIVE POWER BI VIEWS (DirectQuery auto page refresh every 5 seconds)
-- =========================================================================

-- View 1: Active 12 households in the live simulation
CREATE OR REPLACE VIEW public.v_live_households AS
SELECT * FROM public.households WHERE in_live_sim;

-- View 2: Recent 2-day rolling window of simulated consumption readings
CREATE OR REPLACE VIEW public.v_live_consumption AS
SELECT id, household_id, ts, gc_kwh, cl_kwh, gg_kwh,
       (gc_kwh + cl_kwh - gg_kwh) AS net_kwh, EXTRACT(hour FROM ts)::int AS hour
FROM public.consumption_readings
WHERE source = 'simulated'
  AND ts >= (SELECT MAX(ts) FROM public.consumption_readings WHERE source = 'simulated') - INTERVAL '2 days';

-- View 3: Inner join of actual readings with pre-computed forecast partner
CREATE OR REPLACE VIEW public.v_live_actual_vs_predicted AS
SELECT c.household_id, c.ts, c.net_kwh AS actual_net_kwh,
       f.predicted_consumption_kwh - COALESCE(f.predicted_generation_kwh, 0) AS predicted_net_kwh,
       f.predicted_consumption_kwh, f.predicted_generation_kwh,
       c.gc_kwh + c.cl_kwh AS actual_consumption_kwh, c.gg_kwh AS actual_generation_kwh
FROM public.v_live_consumption c
JOIN public.forecasts f ON f.household_id = c.household_id AND f.ts = c.ts;

-- =========================================================================
-- 5. GRANTS
-- =========================================================================
GRANT SELECT ON public.v_live_households TO anon, authenticated, service_role;
GRANT SELECT ON public.v_live_consumption TO anon, authenticated, service_role;
GRANT SELECT ON public.v_live_actual_vs_predicted TO anon, authenticated, service_role;
