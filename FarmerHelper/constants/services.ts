/**
 * The service catalogue that drives the Home tiles and the Map screen.
 *
 * Adding a new service is a one-object change here. The Home grid, the map
 * filter, the marker icon and the quantity label all read from this list.
 *
 * Keep `id` values in sync with the `service_type` check constraint in
 * `supabase/schema.sql` (`tractor`, `sprayer`, `seed`).
 */

export type ServiceId = "tractor" | "sprayer" | "seed";

export type ServiceIcon = "tractor" | "spray" | "seed";

export type ServiceDefinition = {
  id: ServiceId;
  /** Tile title, e.g. "Tractor" */
  label: string;
  /** MaterialCommunityIcons name */
  icon: ServiceIcon;
  /** Plain-language description shown on the tile */
  blurb: string;
  /** What the farmer is buying: land area or seed weight */
  unit: "acre" | "kg";
  /** e.g. "acres" or "kg" */
  unitLabel: string;
  /** Form label for the quantity field */
  quantityLabel: string;
  defaultQuantity: string;
  /** Accent colour for the tile and the map marker */
  accent: { light: string; dark: string };
};

export const SERVICES: ServiceDefinition[] = [
  {
    id: "tractor",
    label: "Tractor",
    icon: "tractor",
    blurb: "Ploughing, land preparation and hauling",
    unit: "acre",
    unitLabel: "acres",
    quantityLabel: "Land size (acres)",
    defaultQuantity: "5",
    accent: { light: "#D98E0B", dark: "#F5B942" },
  },
  {
    id: "sprayer",
    label: "Sprayer",
    icon: "spray",
    blurb: "Pest and disease spraying for your crop",
    unit: "acre",
    unitLabel: "acres",
    quantityLabel: "Land size (acres)",
    defaultQuantity: "8",
    accent: { light: "#1C8FD6", dark: "#5CC2F2" },
  },
  {
    id: "seed",
    label: "Seed",
    icon: "seed",
    blurb: "Quality seed for the coming season",
    unit: "kg",
    unitLabel: "kg",
    quantityLabel: "Seed needed (kg)",
    defaultQuantity: "20",
    accent: { light: "#2E9E51", dark: "#6FD98A" },
  },
];

export const SERVICE_BY_ID = SERVICES.reduce(
  (acc, service) => {
    acc[service.id] = service;
    return acc;
  },
  {} as Record<ServiceId, ServiceDefinition>,
);

export function isServiceId(value: unknown): value is ServiceId {
  return (
    typeof value === "string" && Object.prototype.hasOwnProperty.call(SERVICE_BY_ID, value)
  );
}

/** Resolve an untrusted route param / API value to a known service. */
export function getService(value: unknown): ServiceDefinition | undefined {
  return isServiceId(value) ? SERVICE_BY_ID[value] : undefined;
}

export function getServiceAccent(
  service: ServiceDefinition,
  mode: "light" | "dark",
): string {
  return mode === "dark" ? service.accent.dark : service.accent.light;
}
