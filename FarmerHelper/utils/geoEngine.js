// Real-coordinate FarmMatch engine.
// Replaces the synthetic-grid Dijkstra (utils/farmMatchEngine.js) with
// Haversine distance over provider lat/lng + the same cost/score ranking.

export const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Great-circle (Haversine) distance between two { lat, lng } points, in km.
 */
export function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Rank providers for a farmer request.
 * @param {Object} providers - { id: { name?, lat, lng, services: { type: { price..., available } } } }
 * @param {Object} req - { location:{lat,lng}, service_type, acres, kg_needed,
 *                          max_distance_km, max_total_cost_tk, travel_cost_per_km_tk }
 * @returns {Array<[score, providerName, distanceKm, totalCost]>} sorted best-first
 */
export function rankProviders(providers, req) {
  const {
    location,
    service_type: reqType,
    acres = 0,
    kg_needed = 0,
    max_distance_km: maxDist,
    max_total_cost_tk: maxCost,
    travel_cost_per_km_tk: travelRate,
  } = req;

  const candidates = [];

  for (const [id, p] of Object.entries(providers)) {
    const services = p.services || {};
    if (!(reqType in services)) continue;

    const info = services[reqType];
    if (!info.available) continue;

    const distKm = haversineKm(location, { lat: p.lat, lng: p.lng });
    if (distKm > maxDist) continue;

    const serviceCost =
      reqType === "seed"
        ? info.price_per_kg * kg_needed
        : info.price_per_acre * acres;

    const totalCost = serviceCost + distKm * travelRate;
    if (totalCost > maxCost) continue;

    const costNorm = totalCost / maxCost;
    const distNorm = distKm / maxDist;
    const score = 0.7 * costNorm + 0.3 * distNorm;

    candidates.push([score, p.name || id, distKm, totalCost]);
  }

  candidates.sort((a, b) => a[0] - b[0]);
  return candidates;
}

/**
 * Rank rows returned by the Supabase `nearby_providers` RPC (lat/lng removed,
 * distance precomputed). Produces the same [score, name, km, cost] shape.
 */
export function rankCandidateRows(rows, req) {
  const {
    service_type: reqType,
    acres = 0,
    kg_needed = 0,
    max_distance_km: maxDist,
    max_total_cost_tk: maxCost,
    travel_cost_per_km_tk: rate,
  } = req;

  const out = [];
  for (const r of rows) {
    if (!r.available) continue;
    const serviceCost =
      reqType === "seed" ? r.price * kg_needed : r.price * acres;
    const totalCost = serviceCost + r.distance_km * rate;
    if (totalCost > maxCost) continue;
    const score = 0.7 * (totalCost / maxCost) + 0.3 * (r.distance_km / maxDist);
    out.push([score, r.name || r.id, r.distance_km, totalCost]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

/**
 * Full match with timings. Mirrors the shape of farmMatch() so screens can swap.
 */
export function findBestProvider(providers, req) {
  const t0 = performance.now();
  const ranked = rankProviders(providers, req);
  const elapsed = performance.now() - t0;

  const best = ranked.length > 0 ? ranked[0] : null;

  return {
    best_provider: best ? best[1] : null,
    best_distance_km: best ? best[2] : null,
    best_total_cost_tk: best ? best[3] : null,
    ranked_candidates: ranked,
    dijkstra_time_ms: 0,
    ranking_time_ms: elapsed,
    success: best !== null,
  };
}
