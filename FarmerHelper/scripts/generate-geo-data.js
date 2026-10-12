#!/usr/bin/env node

/**
 * Converts the synthetic RxCy grid (db.json) into real-world coordinates for a
 * chosen region. Each grid step represents STEP_KM real kilometres, and the
 * 10x10 lattice is centered on REGION.center. Grid rows increase northward,
 * columns increase eastward. Providers are placed on their grid node with a
 * small deterministic jitter so co-located providers do not overlap.
 *
 * Outputs:
 *   db.geo.json        - providers (lat/lng + services) + node lookup + metadata
 *   providers.geojson  - GeoJSON FeatureCollection for map visualisation
 *
 * Usage: node scripts/generate-geo-data.js
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Config - change these to target another region / spacing
// ---------------------------------------------------------------------------
const REGION = {
  name: "Rangpur, Bangladesh",
  center: { lat: 25.7439, lng: 89.2752 },
};
const GRID_SIZE = 10; // R0..R9, C0..C9
const STEP_KM = 2; // real distance represented by one grid step (edge weight = 2)
const JITTER_KM = 0.6; // max offset of a provider from its node (within the cell)
const KM_PER_DEG_LAT = 111.32;

const root = process.cwd();
const inputPath = path.join(root, "db.json");
const geoOutPath = path.join(root, "db.geo.json");
const geojsonOutPath = path.join(root, "providers.geojson");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const kmPerDegLng = (lat) => KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

// FNV-1a hash -> stable 32-bit seed from a provider id
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32 PRNG -> deterministic value in [0, 1)
function rand01(seed, salt) {
  let t = (seed + salt * 0x9e3779b9) >>> 0;
  t += 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Build the affine grid transform, centered on REGION.center
// ---------------------------------------------------------------------------
const halfSpanKm = ((GRID_SIZE - 1) / 2) * STEP_KM;
const originLat = REGION.center.lat - halfSpanKm / KM_PER_DEG_LAT;
const originLng =
  REGION.center.lng - halfSpanKm / kmPerDegLng(REGION.center.lat);

function nodeToLatLng(row, col) {
  const lat = originLat + (row * STEP_KM) / KM_PER_DEG_LAT;
  const lng = originLng + (col * STEP_KM) / kmPerDegLng(lat);
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
}

// ---------------------------------------------------------------------------
// Load source data
// ---------------------------------------------------------------------------
const db = JSON.parse(fs.readFileSync(inputPath, "utf8"));

// All grid nodes -> coordinates
const nodes = {};
for (let r = 0; r < GRID_SIZE; r++) {
  for (let c = 0; c < GRID_SIZE; c++) {
    nodes[`R${r}C${c}`] = nodeToLatLng(r, c);
  }
}

// Providers -> coordinates (node + deterministic jitter)
const providers = {};
const features = [];

for (const [id, p] of Object.entries(db.providers || {})) {
  const node = p.location;
  const base = nodes[node];
  if (!base) {
    console.warn(`Skipping ${id}: unknown node ${node}`);
    continue;
  }

  const seed = hash(id);
  const dxKm = (rand01(seed, 1) * 2 - 1) * JITTER_KM;
  const dyKm = (rand01(seed, 2) * 2 - 1) * JITTER_KM;
  const lat = base.lat + dyKm / KM_PER_DEG_LAT;
  const lng = base.lng + dxKm / kmPerDegLng(base.lat);

  providers[id] = {
    name: id,
    node,
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    services: p.services,
  };

  features.push({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [Number(lng.toFixed(6)), Number(lat.toFixed(6))],
    },
    properties: {
      id,
      node,
      services: Object.keys(p.services || {}).filter(
        (s) => p.services[s].available,
      ),
    },
  });
}

// ---------------------------------------------------------------------------
// Write outputs
// ---------------------------------------------------------------------------
const geoData = {
  meta: {
    region: REGION.name,
    grid: `${GRID_SIZE}x${GRID_SIZE} (R0C0..R9C9)`,
    step_km: STEP_KM,
    rows_axis: "north",
    cols_axis: "east",
    center: REGION.center,
    origin_R0C0: nodes.R0C0,
    corner_R9C9: nodes[`R${GRID_SIZE - 1}C${GRID_SIZE - 1}`],
    span_km: (GRID_SIZE - 1) * STEP_KM,
  },
  nodes,
  providers,
};

fs.writeFileSync(geoOutPath, JSON.stringify(geoData, null, 2));
fs.writeFileSync(
  geojsonOutPath,
  JSON.stringify({ type: "FeatureCollection", features }, null, 2),
);

console.log(`✅ Region:      ${REGION.name} (${REGION.center.lat}, ${REGION.center.lng})`);
console.log(`   Origin R0C0: ${nodes.R0C0.lat}, ${nodes.R0C0.lng}`);
console.log(`   Corner R9C9: ${nodes.R9C9.lat}, ${nodes.R9C9.lng}`);
console.log(`   Span:        ${(GRID_SIZE - 1) * STEP_KM} x ${(GRID_SIZE - 1) * STEP_KM} km`);
console.log(`   Providers:   ${Object.keys(providers).length}`);
console.log(`   Wrote:       ${path.basename(geoOutPath)}, ${path.basename(geojsonOutPath)}`);
