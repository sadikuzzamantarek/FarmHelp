-- FarmMatch production schema (Supabase / Postgres + PostGIS)
-- Run this in the Supabase SQL editor. Prerequisite: PostGIS extension,
-- which Supabase projects enable via Database > Extensions.

create extension if not exists postgis;

-- Providers = real world coordinates (lat/lng).
create table if not exists providers (
  id   text primary key,
  name text not null,
  lat  double precision not null,
  lng  double precision not null,
  geog geography(point, 4326) generated always as
       (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored
);

-- GiST index makes radius queries fast at scale.
create index if not exists providers_geog_idx on providers using gist (geog);

-- One row per (provider, service). Same contract as db.json / db.geo.json.
create table if not exists provider_services (
  provider_id  text references providers(id) on delete cascade,
  service_type text not null check (service_type in ('tractor', 'sprayer', 'seed')),
  price        numeric not null, -- per kg (seed) or per acre (tractor/sprayer)
  available    boolean not null default true,
  primary key (provider_id, service_type)
);

-- Radius query + Haversine-scale distance (ST_DistanceSphere on a sphere =
-- the same formula as utils/geoEngine.haversineKm) in a single call.
create or replace function nearby_providers(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision,
  p_service text
) returns table (
  id text,
  name text,
  lat double precision,
  lng double precision,
  distance_km double precision,
  price numeric,
  available boolean
) language sql stable as $$
  select p.id, p.name, p.lat, p.lng,
         st_distancesphere(st_makepoint(p.lng, p.lat), st_makepoint(p_lng, p_lat)) / 1000.0 as distance_km,
         s.price, s.available
  from providers p
  join provider_services s on s.provider_id = p.id
  where s.service_type = p_service
    and s.available = true
    and st_distancesphere(st_makepoint(p.lng, p.lat), st_makepoint(p_lng, p_lat)) <= p_radius_km * 1000
  order by 5;
$$;

-- Minimal demo access (read-only). Lock down before production.
alter table providers enable row level security;
alter table provider_services enable row level security;
drop policy if exists "public read providers" on providers;
drop policy if exists "public read services" on provider_services;
create policy "public read providers" on providers         for select using (true);
create policy "public read services"  on provider_services for select using (true);
grant execute on function nearby_providers to anon;