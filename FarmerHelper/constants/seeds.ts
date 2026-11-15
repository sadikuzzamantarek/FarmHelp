/**
 * Seed catalogue shared by the Seed page, the map picker and the provider
 * detail sheet.
 *
 * IDs must stay in sync with `scripts/lib/seed-varieties.js` (which writes the
 * per-provider prices) and with the `varieties` JSON keys in the database.
 * Prices here are indicative demo ranges, not market data.
 */

export type SeedId =
  | "potato"
  | "bean"
  | "rice"
  | "maize"
  | "mustard"
  | "lentil"
  | "wheat"
  | "jute";

export type SeedDefinition = {
  id: SeedId;
  label: string;
  emoji: string;
  blurb: string;
  /** Indicative demo range shown on the catalogue page */
  priceRange: string;
  accent: { light: string; dark: string };
};

export const SEEDS: SeedDefinition[] = [
  {
    id: "potato",
    label: "Potato",
    emoji: "🥔",
    blurb: "Seed potatoes for the Rabi season",
    priceRange: "Tk 85–220 / kg",
    accent: { light: "#B7791F", dark: "#E8B75C" },
  },
  {
    id: "bean",
    label: "Bean",
    emoji: "🫘",
    blurb: "Country bean and winter bean seed",
    priceRange: "Tk 170–460 / kg",
    accent: { light: "#2E9E51", dark: "#6FD98A" },
  },
  {
    id: "rice",
    label: "Rice",
    emoji: "🌾",
    blurb: "Boro and Aman paddy seed",
    priceRange: "Tk 100–255 / kg",
    accent: { light: "#A3821A", dark: "#E7C75C" },
  },
  {
    id: "maize",
    label: "Maize",
    emoji: "🌽",
    blurb: "Hybrid maize seed",
    priceRange: "Tk 90–230 / kg",
    accent: { light: "#C77700", dark: "#F2CD5C" },
  },
  {
    id: "mustard",
    label: "Mustard",
    emoji: "🌼",
    blurb: "Oilseed mustard for Rabi",
    priceRange: "Tk 125–355 / kg",
    accent: { light: "#C26A0A", dark: "#F5B942" },
  },
  {
    id: "lentil",
    label: "Lentil",
    emoji: "🫛",
    blurb: "Masoor dal seed",
    priceRange: "Tk 150–410 / kg",
    accent: { light: "#B5651D", dark: "#E09B6A" },
  },
  {
    id: "wheat",
    label: "Wheat",
    emoji: "🌿",
    blurb: "Wheat seed for the winter crop",
    priceRange: "Tk 100–245 / kg",
    accent: { light: "#8A6D1B", dark: "#D6BC63" },
  },
  {
    id: "jute",
    label: "Jute",
    emoji: "🎋",
    blurb: "Jute seed for Kharif",
    priceRange: "Tk 75–210 / kg",
    accent: { light: "#4D7C0F", dark: "#8FBF4A" },
  },
];

export const SEED_BY_ID = SEEDS.reduce(
  (acc, seed) => {
    acc[seed.id] = seed;
    return acc;
  },
  {} as Record<SeedId, SeedDefinition>,
);

export function isSeedId(value: unknown): value is SeedId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(SEED_BY_ID, value)
  );
}

export function getSeed(value: unknown): SeedDefinition | undefined {
  return isSeedId(value) ? SEED_BY_ID[value] : undefined;
}

export function getSeedAccent(
  seed: SeedDefinition,
  mode: "light" | "dark",
): string {
  return mode === "dark" ? seed.accent.dark : seed.accent.light;
}
