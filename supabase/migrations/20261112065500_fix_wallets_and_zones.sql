-- ============================================================================
-- Migration: Fix wallet addresses and zone balance for the 12 live houses
-- File: supabase/migrations/20261112065500_fix_wallets_and_zones.sql
-- ============================================================================
--
-- IMPORTANT SECURITY & DESIGN NOTES:
-- 1. Dummy Addresses:
--    Addresses for the 9 dummy households are generated deterministically via:
--      ethers.getAddress(ethers.dataSlice(ethers.id("microgrid-demo-house-" + id), 12))
--    Because they are derived directly from the keccak256 hash of a demo string
--    (not an ECDSA private key), NO KNOWN PRIVATE KEY EXISTS.
--    Any test ETH sent to these dummy addresses is permanently unrecoverable.
--    Use tiny testnet amounts only for on-chain telemetry or testing.
--
-- 2. Real-Wallet Showcase Houses:
--    Households 212 (P3), 18 (C1), and 26 (C2) are reserved for real MetaMask
--    showcase testing. This migration NEVER modifies wallet_address for 212, 18, 26.
--    A manual template is provided at the bottom of this file.
--
-- 3. Zone Rebalancing (Option B - Balanced 4 per zone, 2 prosumer + 2 consumer):
--    - Zone 1: Prosumers (282, 33), Consumers (18, 26)
--    - Zone 2: Prosumers (212, 55), Consumers (48, 90)
--    - Zone 3: Prosumers (244, 112), Consumers (117, 141)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DUMMY WALLET ADDRESS UPDATES (9 houses with valid EIP-55 checksums)
-- ----------------------------------------------------------------------------

-- House 282 (P1, Prosumer)
UPDATE public.households
SET wallet_address = '0x3892f00C2ce9C1395acD5728ab7973447E9c9bb2'
WHERE household_id = 282 AND household_id NOT IN (212, 18, 26);

-- House 33 (P2, Prosumer)
UPDATE public.households
SET wallet_address = '0x00DD4f38e512ab3062b9fa48acD952Ded80318BB'
WHERE household_id = 33 AND household_id NOT IN (212, 18, 26);

-- House 55 (P4, Prosumer)
UPDATE public.households
SET wallet_address = '0xf3927527eeD7EA559A6A0b4883c4fd6350a4a405'
WHERE household_id = 55 AND household_id NOT IN (212, 18, 26);

-- House 244 (P5, Prosumer)
UPDATE public.households
SET wallet_address = '0x77CFf696763269b6024c70B9A59dd8B45cC40751'
WHERE household_id = 244 AND household_id NOT IN (212, 18, 26);

-- House 112 (P6, Prosumer)
UPDATE public.households
SET wallet_address = '0x27b5278Fc4eb1e659C82eF1a78847897d5924960'
WHERE household_id = 112 AND household_id NOT IN (212, 18, 26);

-- House 48 (C3, Consumer)
UPDATE public.households
SET wallet_address = '0xA82149c8ebC8203415ED3350C991C33038FCB3e3'
WHERE household_id = 48 AND household_id NOT IN (212, 18, 26);

-- House 90 (C4, Consumer)
UPDATE public.households
SET wallet_address = '0x209E5f3aa61A3067cd9c95b0D5F6f8033B30d560'
WHERE household_id = 90 AND household_id NOT IN (212, 18, 26);

-- House 117 (C5, Consumer)
UPDATE public.households
SET wallet_address = '0xc46749C76fD1AbE4bE81B034B06e8Dcb31BdB6B2'
WHERE household_id = 117 AND household_id NOT IN (212, 18, 26);

-- House 141 (C6, Consumer)
UPDATE public.households
SET wallet_address = '0xF005bF2fFD9975649EBf96DaAA24f89be18382E2'
WHERE household_id = 141 AND household_id NOT IN (212, 18, 26);

-- ----------------------------------------------------------------------------
-- 2. ZONE REBALANCING (Single CASE update across the 12 live simulation houses)
-- ----------------------------------------------------------------------------
UPDATE public.households
SET zone_id = CASE household_id
  -- Zone 1 (4 houses: 2 prosumers + 2 consumers)
  WHEN 282 THEN 1
  WHEN 33  THEN 1
  WHEN 18  THEN 1
  WHEN 26  THEN 1

  -- Zone 2 (4 houses: 2 prosumers + 2 consumers)
  WHEN 212 THEN 2
  WHEN 55  THEN 2
  WHEN 48  THEN 2
  WHEN 90  THEN 2

  -- Zone 3 (4 houses: 2 prosumers + 2 consumers)
  WHEN 244 THEN 3
  WHEN 112 THEN 3
  WHEN 117 THEN 3
  WHEN 141 THEN 3

  ELSE zone_id
END
WHERE household_id IN (282, 33, 212, 55, 244, 112, 18, 26, 48, 90, 117, 141);

-- ============================================================================
-- 3. REAL-WALLET HOUSES (MANUAL TEMPLATE - NOT EXECUTED BY THIS MIGRATION)
-- Validate each address with ethers.isAddress before running!
-- ============================================================================
-- update households set wallet_address = '<PASTE_REAL_ADDRESS>' where household_id = 212; -- P3 (Seller 1)
-- update households set wallet_address = '<PASTE_REAL_ADDRESS>' where household_id = 18;  -- C1 (Buyer 1)
-- update households set wallet_address = '<PASTE_REAL_ADDRESS>' where household_id = 26;  -- C2 (Buyer 2)

-- ============================================================================
-- 4. VERIFICATION QUERIES (Run to verify zone balance and wallet integrity)
-- ============================================================================
-- A. Verify zone distribution (expect 4 houses per zone, 2 prosumer, 2 consumer):
-- SELECT zone_id,
--        count(*) as total_houses,
--        count(*) FILTER (WHERE role = 'prosumer') as prosumers,
--        count(*) FILTER (WHERE role = 'consumer') as consumers
-- FROM public.households
-- WHERE in_live_sim
-- GROUP BY zone_id
-- ORDER BY zone_id;
--
-- B. Inspect all 12 live simulation households:
-- SELECT household_id, role, zone_id, wallet_address
-- FROM public.households
-- WHERE in_live_sim
-- ORDER BY household_id;
