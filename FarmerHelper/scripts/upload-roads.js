#!/usr/bin/env node

/**
 * Uploads the road graph (road-data.json) into Supabase via the REST API in
 * batched upserts. Avoids the SQL editor's "Query is too large" limit.
 *
 * Prereq:
 *   1. npm run build-roads            (creates supabase/road-data.json)
 *   2. Run supabase/routing-schema.sql once in the SQL editor
 *   3. .env has SUPABASE_SERVICE_ROLE_KEY (inserts bypass RLS)
 *
 * Usage: npm run upload-roads
 */

const fs = require("fs");
const path = require("path");

const root = process.cwd();

function loadEnv() {
  const p = path.join(root, ".env");
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...process.env, ...loadEnv() };
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("❌ .env missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

let supabase;
try {
  supabase = require("@supabase/supabase-js").createClient(url, serviceKey);
} catch (e) {
  console.error("❌ @supabase/supabase-js not installed. Run: npm i @supabase/supabase-js");
  process.exit(1);
}

const dataPath = path.join(root, "supabase", "road-data.json");
if (!fs.existsSync(dataPath)) {
  console.error("❌ supabase/road-data.json not found. Run `npm run build-roads` first.");
  process.exit(1);
}
const { vertices, edges } = JSON.parse(fs.readFileSync(dataPath, "utf8"));

async function upsertInChunks(table, rows, chunkSize) {
  let n = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk);
    if (error) throw new Error(`${table}: ${error.message}`);
    n += chunk.length;
  }
  return n;
}

(async () => {
  console.log(`Uploading ${vertices.length} vertices / ${edges.length} edges...`);

  const vertexRows = vertices.map((v) => ({ id: v.id, lon: v.lng, lat: v.lat }));
  await upsertInChunks("road_vertices", vertexRows, 1000);
  console.log(`✅ road_vertices: ${vertices.length}`);

  const edgeRows = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    cost: e.cost,
    reverse_cost: e.reverse_cost,
    geom: `SRID=4326;${e.geom}`,
  }));
  await upsertInChunks("road_edges", edgeRows, 1000);
  console.log(`✅ road_edges: ${edges.length}`);

  // Sanity: road distance center -> Provider_6 (reachable; ~3.2 km straight).
  const db = JSON.parse(fs.readFileSync(path.join(root, "db.geo.json"), "utf8"));
  const prov = db.providers["Provider_6"];
  const { data, error } = await supabase.rpc("road_distance_km", {
    f_lng: db.meta.center.lng,
    f_lat: db.meta.center.lat,
    t_lng: prov.lng,
    t_lat: prov.lat,
  });
  if (error) {
    console.error("⚠️  Sanity check failed:", error.message);
    process.exitCode = 1;
    return;
  }
  const straight = 3.2;
  console.log(`✅ Sanity: center → Provider_6 road distance = ${(data ?? -1).toFixed(3)} km`);
  if (data > 0) {
    console.log(`   (straight-line is ${straight} km; ratio ${(data / straight).toFixed(2)}x — road should be >= straight-line)`);
  } else {
    console.log("   ⚠ -1 = not reachable by roads (isolated OSM way is normal for some rural spots).");
  }
})().catch((e) => {
  console.error("❌", e.message);
  process.exitCode = 1;
});