#!/usr/bin/env node

/**
 * Builds a REAL ROAD NETWORK graph for the project's Rangpur grid and emits
 * the SQL + a checker GeoJSON.
 *
 *  Data sources (tried in order):
 *   1. Overpass API (fast for the small bbox) — 6 mirrors, short timeout.
 *   2. Geofabrik Bangladesh PBF (ced by bbox)   — reliable static extract,
 *      used automatically when Overpass fails (-v flag). Cached in
 *      scripts/.cache/.
 *
 *  Then every OSM highway becomes a graph edge (vertex id, cost = length km,
 *  geometry). One-way streets honored via reverse_cost = -1.
 *
 *  Writes:
 *    supabase/road-data.sql   (paste in SQL editor)
 *    supabase/road-data.json  (for `npm run upload-roads` primary path)
 *    preview/roads.geojson    (verify on geojson.io)
 *
 *  Usage: node scripts/build-roads.js [--pbf]   (--pbf = skip Overpass)
 */

const fs = require("fs");
const path = require("path");

const OSM_CREDIT =
  "Road data © OpenStreetMap contributors (ODbL). Attribute OSM in the app.";

// ---- grid bbox from db.geo.json, with a small margin ----
const db = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "db.geo.json"), "utf8"),
);
const o = db.meta.origin_R0C0;
const c = db.meta.corner_R9C9;
const M = 0.005;
const BBOX = {
  minLat: o.lat - M,
  minLng: o.lng - M,
  maxLat: c.lat + M,
  maxLng: c.lng + M,
};
const inBbox = (lat, lon) =>
  lat >= BBOX.minLat && lat <= BBOX.maxLat && lon >= BBOX.minLng && lon <= BBOX.maxLng;

const DRIVABLE = new Set([
  "motorway", "trunk", "primary", "secondary", "tertiary",
  "unclassified", "residential", "service", "track", "living_street", "road",
]);
const OVERPASS_QUERY =
  `[out:json][timeout:180];` +
  `(way["highway"](${BBOX.minLat},${BBOX.minLng},${BBOX.maxLat},${BBOX.maxLng}););` +
  `(._;>;);` +
  `out body;`;

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
];

const GEOFABRIK = "https://download.geofabrik.de/asia/bangladesh-latest.osm.pbf";
const CACHE_DIR = path.join(process.cwd(), "scripts", ".cache");
const CACHE_PBF = path.join(CACHE_DIR, "bangladesh-latest.osm.pbf");

const HEADERS = {
  Accept: "*/*",
  "User-Agent": "FarmerHelper-thesis/1.0 (road-graph build script)",
};

// ---- helpers ----
const R = 6371;
const toRad = (d) => (d * Math.PI) / 180;
function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function fetchJson(url, ms = 90000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function reverseCostFor(tag) {
  switch ((tag || "").toLowerCase()) {
    case "yes": case "true": case "1":
      return -1;
    case "-1": case "no": case "false": case "0":
      return 0;
    default:
      return 0;
  }
}

// ---- source 1: Overpass ----
async function tryOverpass() {
  console.log(`🌐 Trying Overpass (bbox ${BBOX.minLat},${BBOX.minLng} → ${BBOX.maxLat},${BBOX.maxLng})`);
  let lastErr = null;
  for (const ep of OVERPASS_ENDPOINTS) {
    try {
      const data = await fetchJson(`${ep}?data=${encodeURIComponent(OVERPASS_QUERY)}`);
      if (!data || !Array.isArray(data.elements)) {
        console.log(`   ⚠ ${ep} → no elements${data && data.remark ? " (" + String(data.remark).slice(0, 120) + ")" : ""}; next mirror…`);
        lastErr = new Error("empty Overpass response");
        continue;
      }
      if (data.remark) {
        console.log(`   ⚠ ${ep} → Overpass remark: ${String(data.remark).slice(0, 120)}; next mirror…`);
        lastErr = new Error("Overpass remark");
        continue;
      }
      // out body gives ways with `nodes` — normalize to `refs` for buildGraph.
      const elements = data.elements.map((el) =>
        el.type === "way"
          ? { type: "way", id: el.id, refs: el.nodes || [], tags: el.tags || {} }
          : el.type === "node"
            ? { type: "node", id: el.id, lat: el.lat, lon: el.lon }
            : el,
      );
      const ways = elements.filter((el) => el.type === "way");
      if (ways.length === 0) {
        console.log(`   ⚠ ${ep} → returned 0 ways; next mirror…`);
        lastErr = new Error("Overpass returned 0 ways");
        continue;
      }
      console.log(`   ✓ ${ep} (${ways.length} ways)`);
      return elements;
    } catch (e) {
      lastErr = e;
      console.log(`   ⚠ ${ep} → ${e.message}`);
    }
  }
  console.log(`   ✗ Overpass unavailable (${lastErr ? lastErr.message : "no data"}). Falling back to Geofabrik…`);
  return null;
}

// ---- source 2: Geofabrik static extract ----
async function downloadPbf() {
  if (fs.existsSync(CACHE_PBF) && fs.statSync(CACHE_PBF).size > 1e6) {
    console.log(`   ✓ using cached ${path.relative(process.cwd(), CACHE_PBF)}`);
    return;
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`⬇️  Downloading Bangladesh OSM extract (${GEOFABRIK})…`);
  const res = await fetch(GEOFABRIK, { headers: HEADERS });
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length") || 0);
  const ws = fs.createWriteStream(CACHE_PBF);
  const reader = res.body.getReader();
  let got = 0;
  const t0 = Date.now();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    ws.write(value);
    got += value.length;
    if (total) {
      const pct = ((got / total) * 100).toFixed(0);
      const mb = (got / 1e6).toFixed(1);
      if (!ws.writableEnded && process.stdout.isTTY) {
        process.stdout.write(`\r   ${mb} MB / ${(total / 1e6).toFixed(1)} MB (${pct}%)`);
      } else {
        process.stdout.write(`\r   ${mb} MB (${(got / 1e6 / ((Date.now() - t0) / 1000)).toFixed(1)} MB/s)  `);
      }
    }
  }
  process.stdout.write("\n");
  ws.end();
  await new Promise((r) => ws.on("finish", r));
}

async function parseGeofabrik() {
  let osmPBF;
  try {
    osmPBF = require("osm-pbf-parser");
  } catch {
    throw new Error("osm-pbf-parser is missing. Run: npm i -D osm-pbf-parser");
  }
  await downloadPbf();
  console.log(`🧱 Parsing ${path.relative(process.cwd(), CACHE_PBF)} (bbox filter ${M}-deg margin)`);
  const elements = [];
  let nodesKept = 0;
  let waysKept = 0;
  const parser = osmPBF(fs.createReadStream(CACHE_PBF));
  await new Promise((resolve, reject) => {
    parser.on("data", (batch) => {
      for (const el of batch) {
        if (el.type === "node") {
          if (inBbox(el.lat, el.lon)) {
            elements.push({ type: "node", id: el.id, lat: el.lat, lon: el.lon });
            nodesKept++;
          }
        } else if (el.type === "way" && DRIVABLE.has(el.tags && el.tags.highway)) {
          elements.push({ type: "way", id: el.id, refs: el.refs || [], tags: el.tags || {} });
          waysKept++;
        }
      }
    });
    parser.on("end", resolve);
    parser.on("error", reject);
  });
  console.log(`✓ Parsed: ${nodesKept} nodes + ${waysKept} drivable ways inside bbox`);
  return elements;
}

// ---- shared graph builder ----
function buildGraph(elements) {
  const nodes = new Map();
  const ways = [];
  for (const el of elements) {
    if (el.type === "node") nodes.set(el.id, { lat: el.lat, lng: el.lon });
    else if (el.type === "way" && Array.isArray(el.refs)) {
      ways.push({ tags: el.tags, refs: el.refs });
    }
  }
  if (!ways.length) throw new Error("No highway ways found in the bbox");

  const vertexOf = new Map();
  const vertices = [];
  let nextVid = 1;
  const vidFor = (nid) => {
    let v = vertexOf.get(nid);
    if (v === undefined) {
      v = nextVid++;
      vertexOf.set(nid, v);
      vertices.push({ id: v, ...nodes.get(nid) });
    }
    return v;
  };

  const edges = [];
  let edgeId = 1;
  let totalKm = 0;
  for (const way of ways) {
    const rc = reverseCostFor(way.tags.oneway);
    const onewayBackward = way.tags.oneway === "-1";
    for (let i = 0; i + 1 < way.refs.length; i++) {
      const a = nodes.get(way.refs[i]);
      const b = nodes.get(way.refs[i + 1]);
      if (!a || !b) continue;
      const km = haversineKm(a, b);
      if (km < 1e-6) continue;
      const src = vidFor(way.refs[i]);
      const tgt = vidFor(way.refs[i + 1]);
      if (src === tgt) continue;
      const cost = Math.round(km * 1e5) / 1e5;
      const reverse = onewayBackward ? cost : rc;
      edges.push({
        id: edgeId++,
        source: src,
        target: tgt,
        cost,
        reverse_cost: reverse < 0 ? -1 : cost,
        geom: `LINESTRING(${a.lng} ${a.lat},${b.lng} ${b.lat})`,
      });
      totalKm += km;
    }
  }
  if (!edges.length) throw new Error("No edges could be built from OSM data");
  return { vertices, edges, totalKm };
}

function emitFiles(vertices, edges, totalKm) {
  console.log(`✅ ${vertices.length} vertices, ${edges.length} edges, ~${totalKm.toFixed(1)} km of roads`);

  const vInserts = [];
  for (let i = 0; i < vertices.length; i += 500) {
    const chunk = vertices.slice(i, i + 500);
    vInserts.push(
      "insert into road_vertices (id, lon, lat) values\n" +
        chunk.map((v) => `  (${v.id}, ${v.lng}, ${v.lat})`).join(",\n") + ";",
    );
  }
  const eInserts = [];
  for (let i = 0; i < edges.length; i += 500) {
    const chunk = edges.slice(i, i + 500);
    eInserts.push(
      "insert into road_edges (id, source, target, cost, reverse_cost, geom) values\n" +
        chunk
          .map(
            (e) =>
              `  (${e.id}, ${e.source}, ${e.target}, ${e.cost}, ${e.reverse_cost}, st_geomfromtext('${e.geom}', 4326))`,
          )
          .join(",\n") +
        ";",
    );
  }

  const sql = [
    "-- Generated by npm run build-roads",
    `-- ${OSM_CREDIT}`,
    "-- Step 2 of 3: paste into the Supabase SQL editor and Run.",
    "",
    "truncate table road_vertices restart identity cascade;",
    "",
    ...vInserts,
    "",
    ...eInserts,
    "",
    "-- sanity: road km should always be >= straight-line km",
    "select name, round(road_distance_km(lng, lat, 25.7439, 89.2752)::numeric, 3) as road_km",
    "from providers where name in ('Provider_6','Provider_87','Provider_15') limit 5;",
    "",
  ].join("\n");

  const sqlPath = path.join(process.cwd(), "supabase", "road-data.sql");
  fs.writeFileSync(sqlPath, sql);

  const dat = { vertices, edges };
  const datPath = path.join(process.cwd(), "supabase", "road-data.json");
  fs.writeFileSync(datPath, JSON.stringify(dat));

  const gjPath = path.join(process.cwd(), "preview", "roads.geojson");
  const fc = {
    type: "FeatureCollection",
    features: edges.map((e) => ({
      type: "Feature",
      properties: { id: e.id, km: e.cost },
      geometry: { type: "LineString", coordinates: lineToCoords(e.geom) },
    })),
  };
  fs.writeFileSync(gjPath, JSON.stringify(fc));

  const sqlSize = (fs.statSync(sqlPath).size / 1024) | 0;
  const jsonSize = (fs.statSync(datPath).size / 1024) | 0;
  console.log(`📄 Wrote road-data.sql (${sqlSize} KB), road-data.json (${jsonSize} KB), roads.geojson`);

  console.log("\n👉 Next (pick one):");
  console.log("   1) npm run upload-roads   <- recommended, no size limit (uses SUPABASE_SERVICE_ROLE_KEY)");
  console.log("   2) paste supabase/road-data.sql in the SQL editor  <- OK only if under ~1 MB");
  console.log("   First run supabase/routing-schema.sql (step 1) once.");
}

(async () => {
  const skipOverpass = process.argv.includes("--pbf");
  let elements = skipOverpass ? null : await tryOverpass();
  if (!elements) {
    elements = await parseGeofabrik();
  }
  const { vertices, edges, totalKm } = buildGraph(elements);
  emitFiles(vertices, edges, totalKm);
})().catch((e) => {
  console.error("❌ build-roads failed:", e.message);
  process.exit(1);
});

function lineToCoords(wkt) {
  const inner = wkt.replace(/^LINESTRING\(/, "").replace(/\)$/, "").trim();
  return inner.split(",").map((p) => p.trim().split(" ").map(Number));
}