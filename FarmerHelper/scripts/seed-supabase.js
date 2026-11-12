#!/usr/bin/env node

/**
 * Seeds Supabase from db.geo.json (Rangpur real-coordinate dataset).
 * Uses the SERVICE ROLE key (bypasses RLS) — it can INSERT, the anon key cannot.
 *
 * Prereq: @supabase/supabase-js (already in package.json)
 *         1. Run supabase/schema.sql in the Supabase SQL editor.
 *         2. Copy .env.example -> .env and fill in, including
 *            SUPABASE_SERVICE_ROLE_KEY.
 *
 * Usage: node scripts/seed-supabase.js
 */

const fs = require("fs");
const path = require("path");

const root = process.cwd();

// Tiny .env loader so plain `node scripts/seed-supabase.js` just works.
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
  console.error(
    "❌ .env is missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

let supabase;
try {
  supabase = require("@supabase/supabase-js").createClient(url, serviceKey);
} catch (e) {
  console.error("❌ @supabase/supabase-js not installed. Run: npm i @supabase/supabase-js");
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(path.join(root, "db.geo.json"), "utf8"));
const providers = db.providers;

const providerRows = [];
const serviceRows = [];
for (const [id, p] of Object.entries(providers)) {
  providerRows.push({ id, name: p.name || id, lat: p.lat, lng: p.lng });
  for (const [service_type, s] of Object.entries(p.services || {})) {
    serviceRows.push({
      provider_id: id,
      service_type,
      price: s.price_per_kg ?? s.price_per_acre,
      available: s.available,
    });
  }
}

async function main() {
  console.log(`Seeding ${providerRows.length} providers / ${serviceRows.length} services...`);

  const { error: e1 } = await supabase.from("providers").upsert(providerRows);
  if (e1) {
    console.error("❌ providers:", e1.message);
    process.exitCode = 1;
    return;
  }
  const { error: e2 } = await supabase.from("provider_services").upsert(serviceRows);
  if (e2) {
    console.error("❌ provider_services:", e2.message);
    process.exitCode = 1;
    return;
  }

  console.log(`✅ Done. ${providerRows.length} providers / ${serviceRows.length} services at ${url}`);

  // Sanity check the search function works for the anon (app) role.
  const { data, error } = await supabase.rpc("nearby_providers", {
    p_lat: db.meta.center.lat,
    p_lng: db.meta.center.lng,
    p_radius_km: 5,
    p_service: "tractor",
  });
  if (error) {
    console.error("⚠️  nearby_providers RPC failed:", error.message);
    process.exitCode = 1;
    return;
  }
  console.log(`✅ nearby_providers test: ${data.length} tractor providers within 5km of center`);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exitCode = 1;
});