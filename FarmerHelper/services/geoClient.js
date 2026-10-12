import { fetchAllGeo } from "./api";
import {
  fetchAllProviders,
  fetchNearbyProviders,
  isSupabaseConfigured,
} from "./supabase";
import { findBestProvider, rankCandidateRows } from "../utils/geoEngine";

export const DEFAULT_REGION = "Rangpur, Bangladesh";
export const DEFAULT_CENTER = { lat: 25.7439, lng: 89.2752 };

/**
 * Builds the app's result object from a ranked candidate list.
 * Same shape as findBestProvider so screens don't care which backend ran.
 */
const buildResult = (ranked, ranking_time_ms) => {
  if (!ranked.length) {
    return {
      success: false,
      ranked_candidates: [],
      dijkstra_time_ms: 0,
      ranking_time_ms,
    };
  }
  const [score, provider, dist, cost] = ranked[0];
  return {
    success: true,
    best_provider: provider,
    best_distance_km: dist,
    best_total_cost_tk: cost,
    dijkstra_time_ms: 0,
    ranking_time_ms,
    ranked_candidates: ranked,
  };
};

/**
 * Load either Supabase (PostGIS) or json-server (db.geo.json) context.
 * Supabase wins when it is configured; otherwise falls back gracefully.
 */
export async function loadGeoContext() {
  if (isSupabaseConfigured()) {
    const rows = await fetchAllProviders();
    const providers = Object.fromEntries(
      rows.map((r) => [r.name || r.id, { ...r, services: {} }]),
    );
    return {
      region: DEFAULT_REGION,
      center: DEFAULT_CENTER,
      providers,
      source: "Supabase / PostGIS",
    };
  }
  const { providers, meta } = await fetchAllGeo();
  return {
    region: meta?.region ?? DEFAULT_REGION,
    center: meta?.center ?? DEFAULT_CENTER,
    providers,
    source: "json-server (db.geo.json)",
  };
}

/** Run a match against whichever backend is configured. */
export async function runGeoMatch(req, providers) {
  const t0 = Date.now();
  if (isSupabaseConfigured()) {
    const rows = await fetchNearbyProviders({
      lat: req.location.lat,
      lng: req.location.lng,
      radiusKm: req.max_distance_km,
      serviceType: req.service_type,
    });
    const ranked = rankCandidateRows(rows, req);
    return buildResult(ranked, Date.now() - t0);
  }
  if (!providers) throw new Error("Providers not loaded");
  return findBestProvider(providers, req);
}