create table households (
  household_id integer primary key,
  role text not null check (role in ('prosumer','consumer')),
  generator_capacity_kw numeric,
  postcode integer,
  has_controlled_load boolean,
  zone_id integer,
  wallet_address text
);

create table consumption_readings (
  id bigserial primary key,
  household_id integer references households(household_id),
  ts timestamptz not null,
  gc_kwh numeric,
  cl_kwh numeric,
  gg_kwh numeric,
  net_kwh numeric,
  source text default 'historical_replay'
);

create table forecasts (
  id bigserial primary key,
  household_id integer references households(household_id),
  ts timestamptz not null,
  predicted_kwh numeric,
  model_used text
);

create table load_balancing_allocations (
  id bigserial primary key,
  zone_id integer,
  ts timestamptz not null,
  grid_supply_kwh numeric,
  battery_kwh numeric,
  solar_surplus_kwh numeric,
  allocated_kwh numeric
);

create table trades (
  id bigserial primary key,
  buyer_household_id integer references households(household_id),
  seller_household_id integer references households(household_id),
  kwh_amount numeric,
  price_per_kwh numeric,
  tx_hash text,
  ts timestamptz not null,
  status text default 'pending'
);

create table grid_status (
  id bigserial primary key,
  ts timestamptz not null,
  total_demand numeric,
  total_supply numeric,
  peak_flag boolean
);