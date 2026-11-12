-- Migration: 20261110185000_trades_settlement.sql
-- Description: Ensure trades table exists with proper schema, RLS policies, and Realtime registration.

CREATE TABLE IF NOT EXISTS public.trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_household_id INT NOT NULL,
    seller_household_id INT NOT NULL,
    kwh_amount NUMERIC(8, 2) NOT NULL,
    price_per_kwh NUMERIC(12, 6) NOT NULL DEFAULT 0.000100,
    total_price_eth NUMERIC(12, 6) NOT NULL DEFAULT 0.000100,
    tx_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_buyer ON public.trades(buyer_household_id);
CREATE INDEX IF NOT EXISTS idx_trades_seller ON public.trades(seller_household_id);
CREATE INDEX IF NOT EXISTS idx_trades_ts ON public.trades(ts DESC);

-- Enable RLS
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on trades" ON public.trades;
CREATE POLICY "Allow public read access on trades" ON public.trades FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert on trades" ON public.trades;
CREATE POLICY "Allow public insert on trades" ON public.trades FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on trades" ON public.trades;
CREATE POLICY "Allow public update on trades" ON public.trades FOR UPDATE USING (true);

GRANT ALL ON public.trades TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.trades TO anon, authenticated;

-- Realtime registration
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

