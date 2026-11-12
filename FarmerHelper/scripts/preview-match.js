#!/usr/bin/env node

/**
 * CLI preview of the real-coordinate FarmMatch engine.
 * Loads db.geo.json (Rangpur grid -> lat/lng) and runs several farmer
 * requests, printing the ranked providers exactly as the app would.
 *
 * The math here mirrors utils/geoEngine.js so the script can run under plain
 * Node (the app files are ESM/transpiled by Metro).
 *
 * Usage: node scripts/preview-match.js
 */

const fs = require("fs");
const path = require("path");

const EARTH_RADIUS_KM = 6371;
const toRad = (d) => (d * Math.PI) / 180;

function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function rankProviders(providers, req) {
  const {
    location,
    service_type: reqType,
    acres = 0,
    kg_needed = 0,
    max_distance_km: maxDist,
    max_total_cost_tk: maxCost,
    travel_cost_per_km_tk: rate,
  } = req;

  const out = [];
  for (const [id, p] of Object.entries(providers)) {
    const s = (p.services || {})[reqType];
    if (!s || !s.available) continue;

    const distKm = haversineKm(location, { lat: p.lat, lng: p.lng });
    if (distKm > maxDist) continue;

    const serviceCost =
      reqType === "seed" ? s.price_per_kg * kg_needed : s.price_per_acre * acres;
    const totalCost = serviceCost + distKm * rate;
    if (totalCost > maxCost) continue;

    const score = 0.7 * (totalCost / maxCost) + 0.3 * (distKm / maxDist);
    out.push([score, p.name || id, distKm, totalCost]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

const db = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "db.geo.json"), "utf8"),
);
const { meta, providers } = db;

console.log(`\n=== FarmMatch (real coords) :: ${meta.region} ===`);
console.log(
  `Grid ${meta.grid} | ${meta.step_km} km/step | center ${meta.center.lat},${meta.center.lng}\n`,
);

const scenarios = [
  {
    name: "Tractor, 5 acres (farmer at Rangpur center)",
    req: {
      location: meta.center,
      service_type: "tractor",
      acres: 5,
      max_distance_km: 12,
      max_total_cost_tk: 2000,
      travel_cost_per_km_tk: 10,
    },
  },
  {
    name: "Seed, 20 kg (farmer at north-west corner R0C0)",
    req: {
      location: db.nodes.R0C0,
      service_type: "seed",
      kg_needed: 20,
      max_distance_km: 10,
      max_total_cost_tk: 4000,
      travel_cost_per_km_tk: 8,
    },
  },
  {
    name: "Sprayer, 8 acres (farmer at south-east corner R9C9)",
    req: {
      location: db.nodes.R9C9,
      service_type: "sprayer",
      acres: 8,
      max_distance_km: 15,
      max_total_cost_tk: 4000,
      travel_cost_per_km_tk: 12,
    },
  },
];

for (const { name, req } of scenarios) {
  const ranked = rankProviders(providers, req);

  console.log(`▶ ${name}`);
  console.log(
    `   service=${req.service_type}  max ${req.max_distance_km} km  budget ${req.max_total_cost_tk} Tk`,
  );

  if (ranked.length === 0) {
    console.log("   ✗ No eligible provider.\n");
    continue;
  }

  console.log(`   ✓ ${ranked.length} eligible provider(s). Best: ${ranked[0][1]}`);
  ranked.slice(0, 5).forEach(([score, pid, dist, cost], i) => {
    console.log(
      `     ${i + 1}. ${pid.padEnd(12)}  ${dist.toFixed(2)} km  ${cost
        .toFixed(0)
        .padStart(5)} Tk  score ${score.toFixed(3)}`,
    );
  });
  console.log("");
}
