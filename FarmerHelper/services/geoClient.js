import { fetchAllGeo } from "./api";
import {
  fetchAllProviderServices,
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
  const [, provider, dist, cost] = ranked[0];
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
 * Turn provider_services rows into the `services` shape the client engine
 * expects: { tractor: { price, price_per_acre, available }, seed: {...} }.
 * Seed offers also carry `varieties` when the database has them.
 */
function groupOffersByProvider(rows) {
  const byProvider = {};
  for (const row of rows) {
    const price = Number(row.price);
    const bucket = (byProvider[row.provider_id] ||= {});
    bucket[row.service_type] = {
      price,
      price_per_acre: row.service_type === "seed" ? undefined : price,
      price_per_kg: row.service_type === "seed" ? price : undefined,
      available: row.available !== false,
      ...(row.service_type === "seed" && row.seed_varieties
        ? { varieties: row.seed_varieties }
        : {}),
    };
  }
  return byProvider;
}

/** True when at least one provider carries per-variety seed prices. */
function hasSeedVarietyData(providers) {
  return Object.values(providers || {}).some((provider) => {
    const varieties = provider?.services?.seed?.varieties;
    return !!varieties && Object.keys(varieties).length > 0;
  });
}

/**
 * Replace the RPC's base seed price with the selected variety's price and drop
 * providers that do not sell that variety. If the dataset has no varieties at
 * all (older database), keep the base price and report a fallback.
 */
function applySeedVariety(rows, req, providers) {
  if (req.service_type !== "seed" || !req.seed_type) {
    return { rows, fallback: false };
  }
  if (!providers) {
    return { rows, fallback: true };
  }

  let fallback = false;
  const enriched = [];

  for (const row of rows) {
    const provider = providers[row.name] ?? providers[row.id];
    const seedOffer = provider?.services?.seed;
    if (!seedOffer) continue;

    const varieties = seedOffer.varieties;
    if (!varieties || Object.keys(varieties).length === 0) {
      // Legacy data: rank with the base per-kg price.
      fallback = true;
      enriched.push(row);
      continue;
    }

    const variety = varieties[req.seed_type];
    if (!variety || variety.available === false) continue;

    const price = Number(variety.price_per_kg ?? variety.price);
    if (!Number.isFinite(price) || price <= 0) continue;

    enriched.push({ ...row, price });
  }

  return { rows: enriched, fallback };
}

function localFallback(providers, req) {
  const result = findBestProvider(providers, req);
  const seedFallback =
    req.service_type === "seed" && req.seed_type
      ? !hasSeedVarietyData(providers)
      : false;
  return {
    ...result,
    distance_kind: distanceLabel(),
    seed_variety_fallback: seedFallback,
  };
}

/**
 * Load either Supabase (PostGIS) or json-server (db.geo.json) context.
 * Supabase wins when it is configured; otherwise falls back gracefully.
 */
export async function loadGeoContext() {
  if (isSupabaseConfigured()) {
    let servicesUnavailable = false;
    const [rows, offers] = await Promise.all([
      fetchAllProviders(),
      fetchAllProviderServices().catch(() => {
        servicesUnavailable = true;
        return [];
      }),
    ]);
    const offersByProvider = groupOffersByProvider(offers);
    const providers = Object.fromEntries(
      rows.map((r) => [
        r.name || r.id,
        { ...r, services: offersByProvider[r.id] ?? {} },
      ]),
    );
    return {
      region: DEFAULT_REGION,
      center: DEFAULT_CENTER,
      providers,
      source: "Supabase / PostGIS",
      servicesUnavailable,
    };
  }
  const { providers, meta } = await fetchAllGeo();
  return {
    region: meta?.region ?? DEFAULT_REGION,
    center: meta?.center ?? DEFAULT_CENTER,
    providers,
    source: "json-server (db.geo.json)",
    servicesUnavailable: false,
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
        if (providers) return localFallback(providers, req);
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
      if (providers && slow(e)) return localFallback(providers, req);
      throw e;
    }
  }

  if (rows) {
    const seeded = applySeedVariety(rows, req, providers);
    const ranked = rankCandidateRows(seeded.rows, req);
    return {
      ...buildResult(ranked, Date.now() - t0),
      distance_kind: distanceLabel(),
      seed_variety_fallback: seeded.fallback,
    };
  }
  if (!providers) throw new Error("Providers not loaded");
  return localFallback(providers, req);
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
const distanceLabel = () => {
  if (_distanceKind === "road") return "road";
  if (_distanceKind === "json-server") return "json-server";
  return "haversine";
};