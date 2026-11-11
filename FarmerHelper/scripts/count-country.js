#!/usr/bin/env node
/** Counts the FULL national drivable road graph (no bbox filter) from the
 *  cached Geofabrik Bangladesh PBF — a dry run for `build-roads --country`. */
const fs = require("fs");
const path = require("path");

const CACHE = path.join(process.cwd(), "scripts", ".cache", "bangladesh-latest.osm.pbf");
if (!fs.existsSync(CACHE)) {
  console.error("PBF cache missing — run: node scripts/build-roads.js --pbf once");
  process.exit(1);
}

const MODE = process.argv[2] || "full";
const SETS = {
  full: [
    "motorway", "trunk", "primary", "secondary", "tertiary",
    "unclassified", "residential", "service", "track", "living_street", "road",
  ],
  mid: [
    "motorway", "trunk", "primary", "secondary", "tertiary",
    "unclassified", "residential", "living_street",
  ],
  backbone: ["motorway", "trunk", "primary", "secondary", "tertiary"],
};
const DRIVABLE = new Set(SETS[MODE] || SETS.full);

const osmPBF = require("osm-pbf-parser");
const nodes = new Set();
let wayCount = 0;
let refTotal = 0;

const t0 = Date.now();
let batches = 0;
const parser = osmPBF();
fs.createReadStream(CACHE).pipe(parser);
parser.on("data", (batch) => {
  batches++;
  if (batches % 500 === 0) {
    process.stdout.write(`\r  batches=${batches} ways=${wayCount} nodes=${nodes.size}   `);
  }
  for (const el of batch) {
    if (el.type === "way" && DRIVABLE.has(el.tags && el.tags.highway)) {
      wayCount++;
      for (const r of el.refs || []) {
        refTotal++;
        nodes.add(r);
      }
    }
  }
});
parser.on("error", (e) => { console.error("parse error:", e.message); process.exit(1); });
parser.on("end", () => {
  const edges = refTotal - wayCount;
  const verts = nodes.size;
  const edgeBytes = edges * 165;   // tuple + 2-pt linestring + overhead
  const vertBytes = verts * 70;
  const indexBytes = (edgeBytes + vertBytes) * 0.55; // GiST + btree
  const totalMB = (edgeBytes + vertBytes + indexBytes) / 1e6;

  console.log(`Parsed in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(`drivable ways   : ${wayCount.toLocaleString()}`);
  console.log(`vertices        : ${verts.toLocaleString()}`);
  console.log(`edges           : ${edges.toLocaleString()}`);
  console.log(`est. graph size : ${(edgeBytes / 1e6).toFixed(0)} MB tables + ${(indexBytes / 1e6).toFixed(0)} MB indexes = ~${totalMB.toFixed(0)} MB total`);
  console.log(`Rangpur bbox comparison: 33,220 v / 34,159 e`);
  console.log(`Supabase free tier = 500 MB total database`);
});
