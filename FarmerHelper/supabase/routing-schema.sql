-- ============================================================
-- pgRouting: REAL ROAD NETWORK matching (Rangpur, Bangladesh)
-- ============================================================
-- Step 1 of 3. Paste this file into the Supabase SQL editor and Run.
-- Then run the generated file "supabase/road-data.sql" (Step 2).
--
-- What this adds:
--   * pgrouting extension
--   * road_vertices  : graph nodes (from OSM road endpoints)
--   * road_edges     : graph edges (each OSM road segment, cost = km)
--   * road_distance_km()          : Dijkstra shortest road distance
--   * nearby_providers_road()     : candidates ranked by REAL road km
-- The app keeps matching via the same score formula, but the
-- "distance_km" now comes from driving the actual road network.
-- ============================================================

create extension if not exists pgrouting;

-- ---- topology tables (empty; data comes from scripts/build-roads.js) ----
create table if not exists road_vertices (
  id   integer primary key,
  lon  double precision not null,
  lat  double precision not null,
  geom geometry(point, 4326) generated always as
       (st_setsrid(st_makepoint(lon, lat), 4326)) stored
);

create table if not exists road_edges (
  id            integer primary key,
  source        integer not null references road_vertices(id),
  target        integer not null references road_vertices(id),
  cost          double precision not null, -- km, forward
  reverse_cost  double precision not null, -- km, backward (-1 = one way)
  geom          geometry(linestring, 4326) not null
);

-- ---- nearest vertex on the road network for a lat/lng point ----
create or replace function nearest_vertex_id(p_lng double precision, p_lat double precision)
returns integer language sql stable
set search_path = public, extensions
as $$
  select id
  from road_vertices
  order by geom <-> st_setsrid(st_makepoint(p_lng, p_lat), 4326)
  limit 1;
$$;

-- ---- shortest REAL ROAD distance (km) between two points ----
-- Locates pgr_dijkstra by name in pg_catalog and calls it schema-qualified,
-- so it works no matter whether the pgrouting extension was installed into
-- `public`, `extensions`, or any other schema.
create or replace function road_distance_km(
  f_lng double precision, f_lat double precision,
  t_lng double precision, t_lat double precision
) returns double precision language plpgsql stable
set search_path = public, extensions
as $$
declare
  s          bigint;
  t          bigint;
  d          double precision;
  pgr_schema text;
begin
  select n.nspname into pgr_schema
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'pgr_dijkstra'
  order by (n.nspname = 'public') desc, (n.nspname = 'extensions') desc
  limit 1;

  if pgr_schema is null then
    raise exception 'pgr_dijkstra not found — enable the pgrouting extension (Dashboard → Database → Extensions)';
  end if;

  s := nearest_vertex_id(f_lng, f_lat);
  t := nearest_vertex_id(t_lng, t_lat);
  if s is null or t is null then
    return -1;
  end if;

  -- pgRouting here exposes pgr_dijkstra(text, bigint, bigint, directed) — no
  -- separate has_rcost arg. reverse_cost on our rows is auto-detected from the
  -- edge SQL (rcost alias); directed=false lets one-way -1 still block reverse.
  execute format(
    'select coalesce(sum(ed.cost), -1) from %I.pgr_dijkstra('
    || '''select id, source, target, cost, reverse_cost as rcost from road_edges'''
    || ', %s::bigint, %s::bigint, false) sp '
    || 'join road_edges ed on ed.id = sp.edge '
    || 'where sp.edge <> -1',
    pgr_schema, s, t
  ) into d;
  return d;
end;
$$;

-- ---- candidates with ROAD distance (Dijkstra), ready for the app's score
-- formula. If a provider is not reachable by roads (isolated farm way in OSM),
-- we fall back to straight-line Haversine km so it is never lost.
--
-- Performance: uses a SINGLE many-to-one pgr_dijkstra (all candidate vertices
-- as the "many" side) instead of one Dijkstra per provider — ~50x fewer graph
-- traversals, safely under PostgREST's statement_timeout.
create or replace function nearby_providers_road(
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
) language plpgsql stable
set search_path = public, extensions
as $$
declare
  pgr_schema text;
  dest       bigint;
  vids       bigint[];
begin
  select n.nspname into pgr_schema
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'pgr_dijkstra'
  order by (n.nspname = 'public') desc, (n.nspname = 'extensions') desc
  limit 1;
  if pgr_schema is null then
    raise exception 'pgr_dijkstra not found — enable the pgrouting extension (Dashboard → Database → Extensions)';
  end if;

  dest := nearest_vertex_id(p_lng, p_lat);

  -- candidate + nearest-vertex for each in-radius offerer (Haversine prefilter)
  select coalesce(array_agg(x.vid), '{}'::bigint[]) into vids
  from (
    select nearest_vertex_id(p.lng, p.lat) as vid
    from providers p
    join provider_services s on s.provider_id = p.id
    where s.service_type = p_service
      and s.available = true
      and st_dwithin(p.geog, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
                     p_radius_km * 1000)
  ) x
  where x.vid is not null;

  -- no drivable roads anywhere near: pure Haversine
  if dest is null or cardinality(vids) = 0 then
    return query
      select pp.id, pp.name, pp.lat, pp.lng,
             st_distancesphere(st_makepoint(pp.lng, pp.lat), st_makepoint(p_lng, p_lat)) / 1000.0,
             ss.price, ss.available
      from providers pp
      join provider_services ss on ss.provider_id = pp.id
      where ss.service_type = p_service and ss.available = true
        and st_dwithin(pp.geog, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
                        p_radius_km * 1000)
      order by 5 nulls last
      limit 100;
    return;
  end if;

  return query execute format(
    'with rd as (
       select sp.start_vid, max(sp.agg_cost) as road_km
       from %I.pgr_dijkstra(''select id, source, target, cost, reverse_cost as rcost from road_edges'', %L::bigint[], %s::bigint, false) sp
       group by sp.start_vid
     ),
     cand as (
       select p.id, p.name, p.lat, p.lng, s.price, s.available,
              nearest_vertex_id(p.lng, p.lat) as vid
       from providers p
       join provider_services s on s.provider_id = p.id
       where s.service_type = %L and s.available = true
         and st_dwithin(p.geog, st_setsrid(st_makepoint(%s, %s), 4326)::geography, %s * 1000)
     )
     select c.id, c.name, c.lat, c.lng,
            case when r.road_km is null then
              st_distancesphere(st_makepoint(c.lng, c.lat), st_makepoint(%s, %s)) / 1000.0
            else r.road_km
            end as distance_km,
            c.price, c.available
     from cand c
     left join rd r on r.start_vid = c.vid
     order by 5 nulls last
     limit 100',
    pgr_schema, vids, dest, p_service, p_lng, p_lat, p_radius_km, p_lng, p_lat
  );
end;
$$;

-- ---- FULL ROAD ROUTE between two points (for the map polyline) ----
-- Returns the pgr_dijkstra path merged into one GeoJSON LineString
-- (lng, lat order). NULL when unreachable. Like road_distance_km, it locates
-- pgr_dijkstra via pg_catalog so it works in any install schema.
create or replace function road_path(
  f_lng double precision, f_lat double precision,
  t_lng double precision, t_lat double precision
) returns text language plpgsql stable
set search_path = public, extensions
as $$
declare
  s          bigint;
  t          bigint;
  pgr_schema text;
  gj         text;
begin
  select n.nspname into pgr_schema
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'pgr_dijkstra'
  order by (n.nspname = 'public') desc, (n.nspname = 'extensions') desc
  limit 1;
  if pgr_schema is null then
    raise exception 'pgr_dijkstra not found — enable the pgrouting extension (Dashboard → Database → Extensions)';
  end if;

  s := nearest_vertex_id(f_lng, f_lat);
  t := nearest_vertex_id(t_lng, t_lat);
  if s is null or t is null then
    return null;
  end if;

  execute format(
    'select case when count(*) = 0 then null else '
    || 'st_asgeojson(st_linemerge(st_collect(ed.geom order by sp.path_seq))) end '
    || 'from %I.pgr_dijkstra('
    || '''select id, source, target, cost, reverse_cost as rcost from road_edges'''
    || ', %s::bigint, %s::bigint, false) sp '
    || 'join road_edges ed on ed.id = sp.edge '
    || 'where sp.edge <> -1',
    pgr_schema, s, t
  ) into gj;
  return gj;
end;
$$;

grant execute on function nearby_providers_road to anon;
grant execute on function road_distance_km to anon;
grant execute on function road_path to anon;
grant execute on function nearest_vertex_id to anon;

-- spatial + lookup indexes (created after tables; fine on empty tables too)
create index if not exists road_vertices_gix on road_vertices using gist (geom);
create index if not exists road_edges_gix on road_edges using gist (geom);
create index if not exists road_edges_source_idx on road_edges (source);
create index if not exists road_edges_target_idx on road_edges (target);