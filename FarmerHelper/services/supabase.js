import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

let _client = null;

/** Phone-network reality: supabase-js has no timeout, so a dead network
 * would hang forever. Race every request against a hard 8s timeout. */
const TIMEOUT_MS = 8000;
function fetchWithTimeout(input, init) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Supabase request timed out")),
      TIMEOUT_MS,
    );
  });
  return Promise.race([fetch(input || "", init || {}), timeout]).finally(() =>
    clearTimeout(timer),
  );
}

/**
 * Lazy Supabase client. Returns null (never throws) until
 * EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env —
 * so the app keeps working against json-server until Supabase is configured.
 */
export function getSupabase() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!_client)
    _client = createClient(url, key, { global: { fetch: fetchWithTimeout } });
  return _client;
}

export const isSupabaseConfigured = () => getSupabase() !== null;

/** All providers (id/name/lat/lng) — used for map markers. */
export async function fetchAllProviders() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured (.env)");
  const { data, error } = await client
    .from("providers")
    .select("id, name, lat, lng");
  if (error) throw error;
  return data;
}

/**
 * Ask PostGIS for providers within radius that offer a service.
 * Distance is computed server-side (Haversine/sphere).
 * @returns rows: { id, name, lat, lng, distance_km, price, available }
 */
export async function fetchNearbyProviders({ lat, lng, radiusKm, serviceType }) {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured (.env)");
  const { data, error } = await client.rpc("nearby_providers", {
    p_lat: lat,
    p_lng: lng,
    p_radius_km: radiusKm,
    p_service: serviceType,
  });
  if (error) throw error;
  return data;
}

/**
 * REAL ROAD DISTANCE version — pgRouting (pgr_dijkstra) on OSM roads.
 * Requires supabase/routing-schema.sql + supabase/road-data.sql to be loaded.
 * Same row shape as fetchNearbyProviders, but distance_km is road km,
 * so the app's score formula is unchanged.
 */
export async function fetchNearbyProvidersRoad({ lat, lng, radiusKm, serviceType }) {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured (.env)");
  const { data, error } = await client.rpc("nearby_providers_road", {
    p_lat: lat,
    p_lng: lng,
    p_radius_km: radiusKm,
    p_service: serviceType,
  });
  if (error) throw error;
  return data;
}

/** Shortest road distance between two points (km) via the road graph. */
export async function fetchRoadDistanceKm(from, to) {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured (.env)");
  const { data, error } = await client.rpc("road_distance_km", {
    f_lng: from.lng,
    f_lat: from.lat,
    t_lng: to.lng,
    t_lat: to.lat,
  });
  if (error) throw error;
  return data;
}

/**
 * Full shortest-road-route polyline via pgr_dijkstra.
 * @returns parsed GeoJSON LineString { type, coordinates: [[lng,lat],…] } or
 *          null when the points aren't connected by roads.
 */
export async function fetchRoadPath(from, to) {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured (.env)");
  const { data, error } = await client.rpc("road_path", {
    f_lng: from.lng,
    f_lat: from.lat,
    t_lng: to.lng,
    t_lat: to.lat,
  });
  if (error) throw error;
  if (typeof data !== "string") return null;
  try {
    const parsed = JSON.parse(data);
    return parsed.coordinates && parsed.coordinates.length > 1 ? parsed : null;
  } catch {
    return null;
  }
}