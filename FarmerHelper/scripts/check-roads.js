#!/usr/bin/env node

/**
 * Verifies live pgRouting in Supabase after you enable the extension:
 *   Dashboard -> Database -> Extensions -> search "pgrouting" -> Enable
 * (SQL equivalent: create extension if not exists pgrouting;)
 *
 * Usage: node scripts/check-roads.js
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const envPath = path.join(process.cwd(), ".env");
if (!fs.existsSync(envPath)) {
  console.error("❌ .env not found. Copy .env.example and fill in your Supabase keys.");
  process.exit(1);
}

const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2];
}

const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const db = JSON.parse(fs.readFileSync(path.join(process.cwd(), "db.geo.json"), "utf8"));
  const { meta, providers } = db;
  const center = meta.center;

  // 1) Single road distance center -> Provider_6
  const p6 = providers["Provider_6"];
  const { data: r6, error: e6 } = await supabase.rpc("road_distance_km", {
    f_lng: center.lng,
    f_lat: center.lat,
    t_lng: p6.lng,
    t_lat: p6.lat,
  });
  if (e6) {
    console.error(`❌ road_distance_km failed: ${e6.message}`);
    console.error("   → Is the pgrouting extension enabled? (Dashboard → Database → Extensions)");
    process.exitCode = 1;
    return;
  }
  console.log(`✅ road_distance_km center → Provider_6      = ${(r6 ?? -1).toFixed(3)} km`);
  console.log(`   ⚠ -1 means the route is unreachable (isolated OSM farm way) — normal for a few rural spots.`);

  // 2) Ranked candidates with real road distance for tractors
  const { data: rows, error: e2 } = await supabase.rpc("nearby_providers_road", {
    p_lat: center.lat,
    p_lng: center.lng,
    p_radius_km: 18,
    p_service: "tractor",
  });
  if (e2) {
    console.error(`❌ nearby_providers_road failed: ${e2.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`✅ nearby_providers_road('tractor', r=18km)  → ${rows.length} providers`);
  for (const r of rows.slice(0, 5)) {
    console.log(`   ${r.name.padEnd(13)} ${r.distance_km.toFixed(2).padStart(6)} km  ${r.price} Tk`);
  }
})();