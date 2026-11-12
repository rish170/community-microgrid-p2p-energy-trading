-- Migration: 20261110183000_energy_requests.sql
-- Description: Create energy_requests table with matching candidates, RLS, and Realtime.

CREATE TABLE IF NOT EXISTS public.energy_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_household_id INT NOT NULL,
    units_kwh NUMERIC(6, 2) NOT NULL,
    duration_hours NUMERIC(4, 1) NOT NULL DEFAULT 4.0,
    price_eth_per_kwh NUMERIC(10, 6) NOT NULL DEFAULT 0.000100,
    total_price_eth NUMERIC(10, 6) NOT NULL DEFAULT 0.000100,
    status TEXT NOT NULL CHECK (status IN ('open', 'pinged', 'accepted', 'settling', 'settled', 'denied', 'unfulfilled', 'cancelled')),
    current_candidate_household_id INT NULL,
    candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
    tx_hash TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups on active status and candidates
CREATE INDEX IF NOT EXISTS idx_energy_requests_status ON public.energy_requests(status);
CREATE INDEX IF NOT EXISTS idx_energy_requests_candidate ON public.energy_requests(current_candidate_household_id);

-- Row-Level Security
ALTER TABLE public.energy_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on energy_requests" ON public.energy_requests;
CREATE POLICY "Allow public read access on energy_requests" ON public.energy_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon insert on energy_requests" ON public.energy_requests;
CREATE POLICY "Allow anon insert on energy_requests" ON public.energy_requests FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update on energy_requests" ON public.energy_requests;
CREATE POLICY "Allow anon update on energy_requests" ON public.energy_requests FOR UPDATE USING (true);

-- Backend service role gets full control
GRANT ALL ON public.energy_requests TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.energy_requests TO anon, authenticated;

-- Enable Supabase Realtime publication
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.energy_requests;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

