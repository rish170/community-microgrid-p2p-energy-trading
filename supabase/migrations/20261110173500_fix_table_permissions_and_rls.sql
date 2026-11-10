-- Migration: 20261110173500_fix_table_permissions_and_rls.sql
-- Description: Grant public read permissions to 'anon' and 'authenticated' roles,
--              grant full administrative permissions to 'service_role',
--              configure Row Level Security (RLS) public read policies,
--              and ensure Supabase Realtime publication includes live microgrid tables.

-- 1. Ensure schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Grant table-level permissions to anon (frontend public client) & authenticated
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;

-- 3. Grant full admin privileges to service_role (backend API with service key)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

-- 4. Enable RLS and add public read policies for core tables
DO $$
BEGIN
    -- households
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'households') THEN
        ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow public read access on households" ON public.households;
        CREATE POLICY "Allow public read access on households" ON public.households FOR SELECT USING (true);
    END IF;

    -- consumption_readings
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'consumption_readings') THEN
        ALTER TABLE public.consumption_readings ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow public read access on consumption_readings" ON public.consumption_readings;
        CREATE POLICY "Allow public read access on consumption_readings" ON public.consumption_readings FOR SELECT USING (true);
    END IF;

    -- forecasts
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'forecasts') THEN
        ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow public read access on forecasts" ON public.forecasts;
        CREATE POLICY "Allow public read access on forecasts" ON public.forecasts FOR SELECT USING (true);
    END IF;

    -- grid_status
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'grid_status') THEN
        ALTER TABLE public.grid_status ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow public read access on grid_status" ON public.grid_status;
        CREATE POLICY "Allow public read access on grid_status" ON public.grid_status FOR SELECT USING (true);
    END IF;

    -- trades
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'trades') THEN
        ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow public read access on trades" ON public.trades;
        CREATE POLICY "Allow public read access on trades" ON public.trades FOR SELECT USING (true);
    END IF;
END $$;

-- 5. Add live tables to supabase_realtime publication (enables WebSocket push)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.consumption_readings;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.forecasts;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.grid_status;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;
