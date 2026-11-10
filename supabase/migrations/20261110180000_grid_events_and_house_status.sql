-- Migration: 20261110180000_grid_events_and_house_status.sql
-- Description: Create grid_events and house_status tables, seed initial battery levels
--              (6.0 kWh capacity, 4.5 kWh initial charge for solar houses),
--              seed wallet addresses for the 12 houses, enable RLS and Realtime.

-- 1. Create grid_events table
CREATE TABLE IF NOT EXISTS public.grid_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope TEXT NOT NULL CHECK (scope IN ('society', 'house')),
    household_id INT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('outage', 'line_cut')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ NULL
);

-- 2. Create house_status table (authoritative live power state & battery levels)
CREATE TABLE IF NOT EXISTS public.house_status (
    household_id INT PRIMARY KEY,
    power_state TEXT NOT NULL DEFAULT 'grid' CHECK (power_state IN ('grid', 'battery', 'blackout', 'line_cut')),
    battery_kwh NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
    battery_capacity_kwh NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
    is_supplied_by_trade BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Configure Row-Level Security (RLS)
ALTER TABLE public.grid_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.house_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on grid_events" ON public.grid_events;
CREATE POLICY "Allow public read access on grid_events" ON public.grid_events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access on house_status" ON public.house_status;
CREATE POLICY "Allow public read access on house_status" ON public.house_status FOR SELECT USING (true);

-- Backend service_role gets full access
GRANT ALL ON public.grid_events TO service_role;
GRANT ALL ON public.house_status TO service_role;
GRANT SELECT ON public.grid_events TO anon, authenticated;
GRANT SELECT ON public.house_status TO anon, authenticated;

-- 4. Enable Supabase Realtime for live WebSocket updates
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.grid_events;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.house_status;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

-- 5. Seed / Update 12 Live Households (ensuring role, in_live_sim, and wallet addresses)
-- 3 Showcase houses ready for real MetaMask addresses:
--   - P3: Household 212 (Showcase Prosumer)
--   - C1: Household 18  (Showcase Consumer 1)
--   - C2: Household 26  (Showcase Consumer 2)
INSERT INTO public.households (household_id, role, generator_capacity_kw, postcode, has_controlled_load, zone_id, wallet_address, in_live_sim)
VALUES
    -- Solar Prosumers (6 houses)
    (282, 'prosumer', 5.0, 2000, true, 1, '0x2820A10B33e7A48E0d5d214691B6554F85920282', true),
    (33,  'prosumer', 4.2, 2000, true, 1, '0x3300C4119d23a1a5b82142e03d12FA4293BC0033', true),
    (212, 'prosumer', 6.0, 2000, true, 1, '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', true), -- [Showcase Prosumer P3]
    (55,  'prosumer', 4.0, 2000, true, 1, '0x5500B92E780a1c3F44c214691B6554F859200055', true),
    (244, 'prosumer', 4.8, 2000, true, 1, '0x2440D26C01e2b585dd299e03d12FA4293BC00244', true),
    (112, 'prosumer', 3.8, 2000, true, 1, '0x1120E38D124a900fa2b585dd299e03d12FA420112', true),
    -- Non-Solar Consumers (6 houses)
    (18,  'consumer', 0.0, 2000, true, 1, '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', true), -- [Showcase Consumer C1]
    (26,  'consumer', 0.0, 2000, true, 1, '0x22B34E12a900fa2b585dd299e03d12FA4293BC0026', true), -- [Showcase Consumer C2]
    (48,  'consumer', 0.0, 2000, true, 1, '0x4800E61B45ab88b098defB751B7401B5f6d80048', true),
    (90,  'consumer', 0.0, 2000, true, 1, '0x9000F77A56c49e0c19a952d7e48270b2df7e0090', true),
    (117, 'consumer', 0.0, 2000, true, 1, '0x1170A83C67e8417c8052de6a900fa2b585dd0117', true),
    (141, 'consumer', 0.0, 2000, true, 1, '0x1410C09F89b3a7281f6c49e0c19a952d7e4820141', true)
ON CONFLICT (household_id) DO UPDATE SET
    role = EXCLUDED.role,
    generator_capacity_kw = EXCLUDED.generator_capacity_kw,
    in_live_sim = EXCLUDED.in_live_sim,
    wallet_address = EXCLUDED.wallet_address;

-- 6. Seed initial house_status for the 12 houses (6.0 kWh capacity, 4.5 kWh initial battery for solar)
INSERT INTO public.house_status (household_id, power_state, battery_kwh, battery_capacity_kwh, is_supplied_by_trade, updated_at)
VALUES
    -- Solar Prosumers: 4.5 kWh initial charge / 6.0 kWh capacity
    (282, 'grid', 4.50, 6.00, false, NOW()),
    (33,  'grid', 4.50, 6.00, false, NOW()),
    (212, 'grid', 4.50, 6.00, false, NOW()),
    (55,  'grid', 4.50, 6.00, false, NOW()),
    (244, 'grid', 4.50, 6.00, false, NOW()),
    (112, 'grid', 4.50, 6.00, false, NOW()),
    -- Non-Solar Consumers: no battery
    (18,  'grid', 0.00, 0.00, false, NOW()),
    (26,  'grid', 0.00, 0.00, false, NOW()),
    (48,  'grid', 0.00, 0.00, false, NOW()),
    (90,  'grid', 0.00, 0.00, false, NOW()),
    (117, 'grid', 0.00, 0.00, false, NOW()),
    (141, 'blackout', 0.00, 0.00, false, NOW()) -- C6 starts in mock blackout for islanded simulation
ON CONFLICT (household_id) DO UPDATE SET
    battery_kwh = EXCLUDED.battery_kwh,
    battery_capacity_kwh = EXCLUDED.battery_capacity_kwh;
