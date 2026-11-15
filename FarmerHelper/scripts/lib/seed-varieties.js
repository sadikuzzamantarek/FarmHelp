/**
 * Deterministic seed-variety price builder shared by the dataset generator and
 * the one-off migration script.
 *
 * The base `price_per_kg` of a provider's seed offer is the anchor; each
 * variety gets a fixed multiplier plus a small deterministic jitter, so the
 * same provider always gets the same prices. Prices are demo data.
 */

const SEED_VARIETIES = [
  { id: "potato", multiplier: 0.85 },
  { id: "bean", multiplier: 1.75 },
  { id: "rice", multiplier: 1.05 },
  { id: "maize", multiplier: 0.9 },
  { id: "mustard", multiplier: 1.35 },
  { id: "lentil", multiplier: 1.55 },
  { id: "wheat", multiplier: 0.95 },
  { id: "jute", multiplier: 0.8 },
];

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

function round5(value) {
  return Math.max(20, Math.round(value / 5) * 5);
}

function buildSeedVarieties(providerId, basePrice) {
  const base =
    Number.isFinite(Number(basePrice)) && Number(basePrice) > 0
      ? Number(basePrice)
      : 100;
  const seed = hash(String(providerId));
  const varieties = {};

  SEED_VARIETIES.forEach((variety, index) => {
    const jitter = 0.92 + rand01(seed, index + 7) * 0.16;
    varieties[variety.id] = {
      price_per_kg: round5(base * variety.multiplier * jitter),
      // ~12% of provider/variety pairs are unavailable in the demo data.
      available: rand01(seed, index + 31) > 0.12,
    };
  });

  return varieties;
}

/** Add `varieties` to a provider's seed offer without touching other services. */
function addSeedVarietiesToProvider(providerId, services) {
  if (!services || !services.seed) return services;
  if (services.seed.varieties) return services;
  return {
    ...services,
    seed: {
      ...services.seed,
      varieties: buildSeedVarieties(providerId, services.seed.price_per_kg),
    },
  };
}

module.exports = {
  SEED_VARIETIES,
  buildSeedVarieties,
  addSeedVarietiesToProvider,
};
