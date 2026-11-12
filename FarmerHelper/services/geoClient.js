import { fetchAllGeo } from "./api";
import {
  fetchAllProviders,
  fetchNearbyProviders,
  fetchNearbyProvidersRoad,
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
  const kind = await getDistanceKind();
  let rows = null;
  const slow = (e) =>
    /timed out|statement timeout|network request failed|failed to fetch/i.test(
      (e && e.message) || "",
    );

  if (kind === "road") {
    try {
      rows = await fetchNearbyProvidersRoad({
        lat: req.location.lat,
        lng: req.location.lng,
        radiusKm: req.max_distance_km,
        serviceType: req.service_type,
      });
    } catch (e) {
      if (!slow(e)) throw e;
      _distanceKind = "haversine"; // degrade to Haversine for future matches
    }
    // A slow/cancelled road query is not a hard failure: retry as Haversine.
    if (!rows) {
      try {
        rows = await fetchNearbyProviders({
          lat: req.location.lat,
          lng: req.location.lng,
          radiusKm: req.max_distance_km,
          serviceType: req.service_type,
        });
      } catch (e) {
        if (providers) return { ...findBestProvider(providers, req), distance_kind: distanceLabel() };
        throw e;
      }
    }
  } else if (kind === "haversine") {
    try {
      rows = await fetchNearbyProviders({
        lat: req.location.lat,
        lng: req.location.lng,
        radiusKm: req.max_distance_km,
        serviceType: req.service_type,
      });
    } catch (e) {
      if (providers && slow(e)) return { ...findBestProvider(providers, req), distance_kind: distanceLabel() };
      throw e;
    }
  }

  if (rows) {
    const ranked = rankCandidateRows(rows, req);
    return {
      ...buildResult(ranked, Date.now() - t0),
      distance_kind: distanceLabel(),
    };
  }
  if (!providers) throw new Error("Providers not loaded");
  return findBestProvider(providers, req);
}

// Detect which distance layer the backend currently offers. First call decides
// and caches; falls back to Haversine if the road graph isn't loaded yet.
let _distanceKind = null;
async function getDistanceKind() {
  if (_distanceKind) return _distanceKind;
  if (!isSupabaseConfigured()) {
    _distanceKind = "json-server";
    return _distanceKind;
  }
  try {
    // Probe the road RPC with a tiny radius — succeeds only if the function +
    // road graph are loaded in the database.
    await fetchNearbyProvidersRoad({
      lat: 25.7439,
      lng: 89.2752,
      radiusKm: 1,
      serviceType: "tractor",
    });
    _distanceKind = "road";
    return _distanceKind;
  } catch {
    _distanceKind = "haversine";
    return _distanceKind;
  }
}
const distanceLabel = () => (_distanceKind === "road" ? "road" : "haversine");