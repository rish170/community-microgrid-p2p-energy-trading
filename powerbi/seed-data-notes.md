# Power BI / Supabase Setup Notes

## Schema
See `schema.sql` — 6 tables created in Supabase matching the shared project brief.

## Seed data
Imported `households_seed.csv` (30 households) and `sample_readings_seed.csv`
(2 days of real Ausgrid readings) directly via Supabase Table Editor's CSV import,
to unblock dashboard building before the live replay pipeline exists.

## Known placeholder
`zone_id` in households table is a temporary `household_id % 3` split —
needs to be replaced once the data-API teammate finalizes real zone logic.

## Connection
Power BI Desktop connected via PostgreSQL connector, Session Pooler mode, Import (not DirectQuery).