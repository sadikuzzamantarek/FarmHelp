#!/usr/bin/env node

/**
 * Adds per-variety seed prices to every provider that offers seed.
 *
 * Reads/writes db.geo.json in place. Idempotent: providers that already have
 * `services.seed.varieties` are left untouched.
 *
 * The same builder is used by scripts/generate-geo-data.js, so regenerating
 * the dataset keeps the varieties.
 *
 * Usage: node scripts/add-seed-varieties.js
 *        npm run add-seed-varieties
 */

const fs = require("fs");
const path = require("path");

const {
  SEED_VARIETIES,
  addSeedVarietiesToProvider,
} = require("./lib/seed-varieties");

const root = process.cwd();
const filePath = path.join(root, "db.geo.json");

if (!fs.existsSync(filePath)) {
  console.error("❌ db.geo.json not found. Run from the project root.");
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(filePath, "utf8"));
const providers = db.providers || {};

let seededProviders = 0;
const pricesByVariety = {};

for (const [id, provider] of Object.entries(providers)) {
  if (!provider.services || !provider.services.seed) continue;

  provider.services = addSeedVarietiesToProvider(id, provider.services);
  seededProviders += 1;

  const varieties = provider.services.seed.varieties || {};
  for (const [varietyId, offer] of Object.entries(varieties)) {
    (pricesByVariety[varietyId] ||= []).push(offer.price_per_kg);
  }
}

fs.writeFileSync(filePath, `${JSON.stringify(db, null, 2)}\n`);

console.log(`✅ Seed varieties added for ${seededProviders} providers`);

for (const { id } of SEED_VARIETIES) {
  const prices = pricesByVariety[id] || [];
  if (!prices.length) continue;
  console.log(
    `   ${id.padEnd(8)} Tk ${Math.min(...prices)}–${Math.max(...prices)}/kg (${prices.length} offers)`,
  );
}

console.log("\nNext:");
console.log("  1. Run the SQL in supabase/schema.sql (adds provider_services.seed_varieties)");
console.log("  2. npm run seed-supabase");
