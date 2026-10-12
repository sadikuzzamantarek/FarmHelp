import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

let _client = null;

/**
 * Lazy Supabase client. Returns null (never throws) until
 * EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env —
 * so the app keeps working against json-server until Supabase is configured.
 */
export function getSupabase() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!_client) _client = createClient(url, key);
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