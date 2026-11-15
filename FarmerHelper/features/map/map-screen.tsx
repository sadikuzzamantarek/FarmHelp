import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
} from "@maplibre/maplibre-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Skeleton } from "@/components/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { withAlpha } from "@/constants/app-theme";
import {
  SERVICES,
  getService,
  getServiceAccent,
  type ServiceId,
} from "@/constants/services";
import {
  SEEDS,
  getSeed,
  getSeedAccent,
  type SeedId,
} from "@/constants/seeds";
import { useAppTheme } from "@/contexts/app-theme";
import { useToast } from "@/contexts/toast";

import {
  DEFAULT_CENTER,
  loadGeoContext,
  runGeoMatch,
} from "@/services/geoClient";
import { fetchRoadPath } from "@/services/supabase";
import { ProviderDetails } from "./provider-details";

const MAP_STYLES = {
  light: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

type MdiName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type StatusTone = "ok" | "warn" | "error" | "loading";

const sourceLabel = (source: string) =>
  source.startsWith("Supabase") ? "Live provider data" : "Offline demo data";

const distanceLabel = (kind?: string) =>
  kind === "road"
    ? "Real road distance"
    : kind === "haversine"
      ? "Straight-line distance (fallback)"
      : kind === "json-server"
        ? "Offline demo data"
        : "Match complete";

/**
 * Map-first matching screen.
 *
 * Receives `?service=tractor|sprayer|seed` from the Home tiles, shows only
 * providers offering that service, and uses a service-specific marker icon.
 *
 * Requires a development build (MapLibre is NOT available in Expo Go).
 */
export default function MapScreen() {
  const mapRef = useRef<any>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, mode, isDark } = useAppTheme();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ service?: string; seed?: string }>();
  const routeServiceId = getService(params.service)?.id;
  const routeSeedId = getSeed(params.seed)?.id;

  const [providers, setProviders] = useState<any>({});
  const [center, setCenter] = useState<any>(DEFAULT_CENTER);
  const [result, setResult] = useState<any>(null);
  const [status, setStatus] = useState("Loading providers…");
  const [statusTone, setStatusTone] = useState<StatusTone>("loading");
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [matching, setMatching] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showCandidates, setShowCandidates] = useState(false);
  const [roadLine, setRoadLine] = useState<[number, number][] | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    null,
  );

  // Farmer request options
  const [serviceType, setServiceType] = useState<ServiceId>(
    () => routeServiceId ?? "tractor",
  );
  const [seedId, setSeedId] = useState<SeedId>(() => routeSeedId ?? SEEDS[0].id);
  const [acres, setAcres] = useState("5");
  const [kgNeeded, setKgNeeded] = useState("20");
  const [maxDistanceKm, setMaxDistanceKm] = useState("12");
  const [maxTotalCostTk, setMaxTotalCostTk] = useState("2000");
  const [travelCostPerKm, setTravelCostPerKm] = useState("10");

  const activeService = getService(serviceType) ?? SERVICES[0];
  const activeSeed = getSeed(seedId) ?? SEEDS[0];
  const accent = getServiceAccent(activeService, mode);
  const isSeed = activeService.unit === "kg";

  const statusColor =
    statusTone === "error"
      ? colors.danger
      : statusTone === "warn"
        ? colors.accent
        : statusTone === "loading"
          ? isDark
            ? colors.primary
            : "#FFFFFF"
          : colors.primary;

  const statusIcon: MdiName =
    statusTone === "error"
      ? "alert-circle-outline"
      : statusTone === "warn"
        ? "alert-outline"
        : statusTone === "loading"
          ? "progress-clock"
          : "check-circle-outline";

  // A tile tap on Home updates the route param after the screen is mounted.
  useEffect(() => {
    if (routeServiceId) setServiceType(routeServiceId);
  }, [routeServiceId]);

  useEffect(() => {
    if (routeSeedId) setSeedId(routeSeedId);
  }, [routeSeedId]);

  // Never show a result that belongs to a different service or seed.
  useEffect(() => {
    setResult(null);
    setRoadLine(null);
    setShowCandidates(false);
    setSelectedProviderId(null);
  }, [serviceType, seedId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingProviders(true);
      setProviderError(null);
      setSelectedProviderId(null);
      setStatus("Loading providers…");
      setStatusTone("loading");

      try {
        const ctx = await loadGeoContext();
        if (cancelled) return;

        setProviders(ctx.providers ?? {});
        setCenter(ctx.center);

        const offline = !ctx.source.startsWith("Supabase");
        setStatus(sourceLabel(ctx.source));
        setStatusTone(offline ? "warn" : "ok");

        if (offline) {
          showToast(
            "Supabase is unavailable — showing offline demo data.",
            "warning",
          );
        } else if ((ctx as any).servicesUnavailable) {
          setStatusTone("warn");
          showToast(
            "Service details could not be loaded — pins may include providers without this service.",
            "warning",
          );
        }
      } catch (error: any) {
        if (cancelled) return;
        console.error("Backend unavailable:", error.message);
        setProviderError(error?.message ?? "Could not load providers.");
        setStatus("Provider data unavailable");
        setStatusTone("error");
        showToast(
          "Could not load providers. Tap Try again on the map card.",
          "error",
        );
      } finally {
        if (!cancelled) setLoadingProviders(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, showToast]);

  /** Markers only for providers that offer the selected service/seed. */
  const providerEntries = useMemo(() => {
    return Object.entries(providers).filter(([, provider]: [string, any]) => {
      const offers = provider?.services ?? {};
      // Supabase + json-server both populate services. If offers could not be
      // loaded at all, show every provider rather than an empty map.
      if (Object.keys(offers).length === 0) return true;

      const offer = offers[serviceType];
      if (!offer || offer.available === false) return false;

      if (serviceType === "seed" && seedId) {
        const varieties = offer.varieties;
        if (varieties && Object.keys(varieties).length > 0) {
          const variety = varieties[seedId];
          return !!variety && variety.available !== false;
        }
      }

      return true;
    });
  }, [providers, serviceType, seedId]);

  /** After a match, keep only providers that passed the distance/budget filter. */
  const rankedNames = useMemo(() => {
    if (!result?.success) return null;
    return new Set(
      (result.ranked_candidates as any[]).map((row) => row[1] as string),
    );
  }, [result]);

  const visibleEntries = useMemo(() => {
    if (!rankedNames) return providerEntries;
    return providerEntries.filter(([id, provider]: [string, any]) =>
      rankedNames.has(provider.name) || rankedNames.has(id),
    );
  }, [providerEntries, rankedNames]);

  const bestKey = useMemo(() => {
    if (!result?.success) return null;
    return (
      Object.keys(providers).find(
        (key) =>
          providers[key]?.name === result.best_provider ||
          key === result.best_provider,
      ) ?? null
    );
  }, [providers, result]);

  const openProviderByName = (name: string) => {
    const key = Object.keys(providers).find(
      (candidate) =>
        providers[candidate]?.name === name || candidate === name,
    );
    if (key) {
      setSelectedProviderId(key);
    } else {
      showToast("Provider details are not available for this result.", "info");
    }
  };

  const onRegionDidChange = async () => {
    const c = await mapRef.current?.getCenter(); // [lng, lat]
    if (c) setCenter({ lat: c[1], lng: c[0] });
  };

  const runMatch = async () => {
    if (!center) return;

    if (loadingProviders) {
      showToast("Providers are still loading. Try again in a moment.", "info");
      return;
    }

    const distance = Number(maxDistanceKm);
    const budget = Number(maxTotalCostTk);
    const quantity = isSeed ? Number(kgNeeded) : Number(acres);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      const message = isSeed
        ? "Enter how many kg of seed you need."
        : "Enter how many acres you need.";
      setStatus(message);
      setStatusTone("error");
      showToast(message, "error");
      return;
    }
    if (!Number.isFinite(distance) || distance <= 0) {
      const message = "Enter a maximum distance greater than zero.";
      setStatus(message);
      setStatusTone("error");
      showToast(message, "error");
      return;
    }
    if (!Number.isFinite(budget) || budget <= 0) {
      const message = "Enter a maximum budget greater than zero.";
      setStatus(message);
      setStatusTone("error");
      showToast(message, "error");
      return;
    }

    const req = {
      location: center,
      service_type: serviceType,
      seed_type: isSeed ? seedId : undefined,
      acres: Number(acres) || 0,
      kg_needed: Number(kgNeeded) || 0,
      max_distance_km: distance,
      max_total_cost_tk: budget,
      travel_cost_per_km_tk: Number(travelCostPerKm) || 0,
    };

    setMatching(true);
    setResult(null);
    setRoadLine(null);
    setShowCandidates(false);
    setStatus("Finding the best provider…");
    setStatusTone("loading");

    try {
      const r = await runGeoMatch(req, providers);
      const kind = (r as any).distance_kind;
      setResult(r);
      setRoadLine(null);

      if (r.success) {
        const count = r.ranked_candidates.length;
        const seedFallback = !!(r as any).seed_variety_fallback;
        setShowCandidates(true);
        setStatus(distanceLabel(kind));
        setStatusTone(kind === "road" && !seedFallback ? "ok" : "warn");

        if (seedFallback) {
          showToast(
            "Seed variety prices are not loaded — using the base seed price. Run the seed migration and reseed.",
            "warning",
          );
        } else if (kind === "road") {
          showToast(
            `Found ${count} eligible providers. Best: ${r.best_provider}.`,
            "success",
          );
        } else {
          showToast(
            `Found ${count} providers using straight-line distance — road data is unavailable.`,
            "warning",
          );
        }

        if (kind === "road") {
          const targetKey = Object.keys(providers).find(
            (key) =>
              providers[key]?.name === r.best_provider ||
              key === r.best_provider,
          );
          const target = targetKey ? providers[targetKey] : null;
          if (target) {
            fetchRoadPath(center, { lat: target.lat, lng: target.lng })
              .then((gj: any) => {
                if (gj) {
                  setRoadLine(gj.coordinates);
                } else {
                  setRoadLine(null);
                  showToast(
                    "No road route found — showing a straight line.",
                    "warning",
                  );
                }
              })
              .catch(() => {
                setRoadLine(null);
                showToast(
                  "Route line could not be drawn for this match.",
                  "warning",
                );
              });
          }
        }
      } else {
        setStatus("No eligible provider");
        setStatusTone("error");
        showToast(
          "No provider matched. Increase your budget or search distance.",
          "error",
        );
      }
    } catch (error: any) {
      setStatus("Match failed");
      setStatusTone("error");
      showToast(
        error?.message
          ? `Match failed: ${error.message}`
          : "Match failed. Please try again.",
        "error",
      );
    } finally {
      setMatching(false);
    }
  };

  const best = bestKey ? providers[bestKey] : null;
  const bestName = result?.success ? result.best_provider : null;
  const bestSeedVariety =
    isSeed && best ? best.services?.seed?.varieties?.[seedId] : null;
  const bestSeedPrice = bestSeedVariety
    ? Number(bestSeedVariety.price_per_kg ?? bestSeedVariety.price)
    : null;
  const hasRoadPath = !!(roadLine && roadLine.length > 1);
  const route: GeoJSON.Feature | null =
    best && center
      ? {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates:
              hasRoadPath && best
                ? roadLine
                : [
                    [center.lng, center.lat],
                    [best.lng, best.lat],
                  ],
          },
        }
      : null;

  return (
    <View style={styles.flex}>
      <Map
        ref={mapRef}
        mapStyle={isDark ? MAP_STYLES.dark : MAP_STYLES.light}
        onRegionDidChange={onRegionDidChange}
        style={styles.flex}
      >
        <Camera
          initialViewState={{ center: [center.lng, center.lat], zoom: 11 }}
        />

        {visibleEntries.map(([id, p]: [string, any]) => {
          const isBest = !!bestName && (p.name === bestName || id === bestName);
          return (
            <Marker
              key={id}
              lngLat={[p.lng, p.lat]}
              anchor="bottom"
              onPress={() => setSelectedProviderId(id)}
            >
              <View
                style={[
                  styles.providerPin,
                  {
                    backgroundColor: isBest ? accent : colors.surface,
                    borderColor: isBest ? accent : colors.border,
                    shadowColor: colors.shadow,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={activeService.icon}
                  size={isBest ? 18 : 15}
                  color={isBest ? "#0B1508" : accent}
                />
              </View>
            </Marker>
          );
        })}

        {route && (
          <GeoJSONSource id="route" data={route}>
            {hasRoadPath
              ? [
                  <Layer
                    key="route-casing"
                    id="route-casing"
                    type="line"
                    style={{
                      lineColor: isDark ? "#0B100C" : "#1B1B1B",
                      lineWidth: 8,
                      lineCap: "round",
                      lineJoin: "round",
                    }}
                  />,
                  <Layer
                    key="route-line"
                    id="route-line"
                    type="line"
                    style={{
                      lineColor: accent,
                      lineWidth: 4,
                      lineCap: "round",
                      lineJoin: "round",
                    }}
                  />,
                ]
              : (
                  <Layer
                    key="route-dashed"
                    id="route-dashed"
                    type="line"
                    style={{
                      lineColor: accent,
                      lineWidth: 4,
                      lineDasharray: [4, 2],
                    }}
                  />
                )}
          </GeoJSONSource>
        )}
      </Map>

      {/* Status + theme control */}
      <View
        pointerEvents="box-none"
        style={[styles.topBar, { top: insets.top + 8 }]}
      >
          <View
            pointerEvents="none"
            style={[styles.statusPill, { backgroundColor: colors.overlay }]}
          >
            <MaterialCommunityIcons
              name={statusIcon}
              size={14}
              color={statusColor}
            />
            <Text style={styles.statusText} numberOfLines={1}>
              {status}
            </Text>
          </View>
        <ThemeToggle compact />
      </View>

      {/* Fixed farmer crosshair = map center */}
      <View pointerEvents="none" style={styles.crosshair}>
        <View
          style={[
            styles.crosshairRing,
            {
              borderColor: colors.primary,
              backgroundColor: withAlpha(colors.primary, isDark ? 0.24 : 0.16),
            },
          ]}
        >
          <View
            style={[styles.crosshairDot, { backgroundColor: colors.primary }]}
          />
        </View>
      </View>

      {/* Options + result sheet */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.shadow,
            bottom: 12,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? "Collapse search options" : "Expand search options"
          }
          onPress={() => setExpanded(!expanded)}
          style={styles.cardHeader}
        >
          <View
            style={[
              styles.cardIcon,
              { backgroundColor: withAlpha(accent, isDark ? 0.22 : 0.14) },
            ]}
          >
            <MaterialCommunityIcons
              name={activeService.icon}
              size={21}
              color={accent}
            />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={[styles.title, { color: colors.text }]}>
              {isSeed ? `${activeSeed.label} seed` : activeService.label} near
              you
            </Text>
            {result?.success ? (
              <Text
                style={[styles.subtitle, { color: colors.primary }]}
                numberOfLines={1}
              >
                Best: {result.best_provider} ·{" "}
                {result.best_distance_km.toFixed(1)} km ·{" "}
                {result.best_total_cost_tk.toFixed(0)} Tk
              </Text>
            ) : (
              <Text
                style={[styles.subtitle, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {visibleEntries.length} providers ·{" "}
                {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
              </Text>
            )}
          </View>
          <MaterialCommunityIcons
            name={expanded ? "chevron-down" : "chevron-up"}
            size={22}
            color={colors.textMuted}
          />
        </Pressable>

        {expanded && (
          <ScrollView
            style={styles.cardScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Service chips */}
            <View style={styles.chips}>
              {SERVICES.map((service) => {
                const chipAccent = getServiceAccent(service, mode);
                const active = service.id === serviceType;
                return (
                  <Pressable
                    key={service.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setServiceType(service.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? chipAccent : colors.chip,
                        borderColor: active ? chipAccent : colors.border,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={service.icon}
                      size={14}
                      color={active ? "#0B1508" : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? "#0B1508" : colors.text },
                      ]}
                    >
                      {service.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {isSeed ? (
              <>
                <View style={styles.seedHeaderRow}>
                  <Text
                    style={[styles.seedLabel, { color: colors.textMuted }]}
                  >
                    Seed type
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="See all seeds"
                    onPress={() => router.push("/seeds")}
                    style={styles.seeAllButton}
                  >
                    <Text
                      style={[styles.seeAllText, { color: colors.primary }]}
                    >
                      See all
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={13}
                      color={colors.primary}
                    />
                  </Pressable>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.seedChips}
                >
                  {SEEDS.map((seed) => {
                    const seedAccent = getSeedAccent(seed, mode);
                    const active = seed.id === seedId;
                    return (
                      <Pressable
                        key={seed.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => setSeedId(seed.id)}
                        style={[
                          styles.seedChip,
                          {
                            backgroundColor: active
                              ? seedAccent
                              : colors.chip,
                            borderColor: active ? seedAccent : colors.border,
                          },
                        ]}
                      >
                        <Text style={styles.seedEmoji}>{seed.emoji}</Text>
                        <Text
                          style={[
                            styles.seedChipText,
                            { color: active ? "#0B1508" : colors.text },
                          ]}
                        >
                          {seed.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            <Text style={[styles.label, { color: colors.textMuted }]}>
              {activeService.quantityLabel}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.chip,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              keyboardType="numeric"
              placeholderTextColor={colors.textMuted}
              value={isSeed ? kgNeeded : acres}
              onChangeText={isSeed ? setKgNeeded : setAcres}
            />

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  Max distance (km)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.chip,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                  value={maxDistanceKm}
                  onChangeText={setMaxDistanceKm}
                />
              </View>
              <View style={styles.half}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  Travel cost / km (Tk)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.chip,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                  value={travelCostPerKm}
                  onChangeText={setTravelCostPerKm}
                />
              </View>
            </View>

            <Text style={[styles.label, { color: colors.textMuted }]}>
              Max total cost (Tk)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.chip,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              keyboardType="numeric"
              placeholderTextColor={colors.textMuted}
              value={maxTotalCostTk}
              onChangeText={setMaxTotalCostTk}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Find best provider"
              disabled={matching}
              onPress={runMatch}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: colors.primary,
                  opacity: matching ? 0.6 : pressed ? 0.86 : 1,
                },
              ]}
            >
              {matching ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <MaterialCommunityIcons
                  name="magnify"
                  size={20}
                  color={colors.onPrimary}
                />
              )}
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: colors.onPrimary },
                ]}
              >
                {matching ? "Finding providers…" : "Find best provider"}
              </Text>
            </Pressable>

            {matching ? (
              <MatchSkeleton />
            ) : result?.success ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${result.best_provider} details`}
                  onPress={() => bestKey && setSelectedProviderId(bestKey)}
                  style={[
                    styles.bestCard,
                    {
                      backgroundColor: colors.primarySoft,
                      borderColor: withAlpha(colors.primary, 0.35),
                    },
                  ]}
                >
                  <Text
                    style={[styles.bestTag, { color: colors.primary }]}
                  >
                    BEST MATCH
                  </Text>
                  <Text
                    style={[styles.bestName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {result.best_provider}
                  </Text>
                  <View style={styles.metaRow}>
                    <InfoPill
                      icon="map-marker-distance"
                      text={`${result.best_distance_km.toFixed(1)} km`}
                      color={colors.textMuted}
                      background={colors.chip}
                    />
                    <InfoPill
                      icon="cash"
                      text={`${result.best_total_cost_tk.toFixed(0)} Tk`}
                      color={colors.textMuted}
                      background={colors.chip}
                    />
                    {isSeed && bestSeedPrice != null ? (
                      <InfoPill
                        icon="seed-outline"
                        text={`Tk ${bestSeedPrice.toFixed(0)}/kg`}
                        color={colors.textMuted}
                        background={colors.chip}
                      />
                    ) : null}
                  </View>

                  <View style={styles.detailsHintRow}>
                    <Text
                      style={[styles.detailsHint, { color: colors.primary }]}
                    >
                      Tap for services and contact
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={14}
                      color={colors.primary}
                    />
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setShowCandidates(!showCandidates)}
                  style={[
                    styles.candidatesToggle,
                    { borderTopColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.candidatesToggleText,
                      { color: colors.primary },
                    ]}
                  >
                    {showCandidates ? "Hide" : "Show"} all{" "}
                    {result.ranked_candidates.length} providers
                  </Text>
                  <MaterialCommunityIcons
                    name={showCandidates ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.primary}
                  />
                </Pressable>

                {showCandidates &&
                  (result.ranked_candidates as any[]).map(
                    (line: any, i: number) => {
                      const [, name, dist, cost] = line;
                      return (
                        <Pressable
                          key={name + i}
                          accessibilityRole="button"
                          accessibilityLabel={`${name} details`}
                          onPress={() => openProviderByName(name)}
                          style={[
                            styles.candidateRow,
                            { borderBottomColor: colors.border },
                            i === 0 && {
                              backgroundColor: colors.primarySoft,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.candidateRank,
                              { color: colors.textMuted },
                            ]}
                          >
                            {i + 1}.
                          </Text>
                          <Text
                            style={[
                              styles.candidateName,
                              { color: colors.text },
                            ]}
                            numberOfLines={1}
                          >
                            {name}
                          </Text>
                          <Text
                            style={[
                              styles.candidateMeta,
                              { color: colors.textMuted },
                            ]}
                          >
                            {dist.toFixed(1)} km · {cost.toFixed(0)} Tk
                          </Text>
                          <MaterialCommunityIcons
                            name="chevron-right"
                            size={15}
                            color={colors.textMuted}
                          />
                        </Pressable>
                      );
                    },
                  )}
              </>
            ) : result ? (
              <View
                style={[
                  styles.emptyCard,
                  { backgroundColor: colors.chip },
                ]}
              >
                <MaterialCommunityIcons
                  name="map-marker-off-outline"
                  size={20}
                  color={colors.textMuted}
                />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No eligible provider. Try a higher budget or a longer
                  distance.
                </Text>
              </View>
            ) : null}

            <Text style={[styles.pinHint, { color: colors.textMuted }]}>
              Tap any provider pin, or a result, to see services, prices and
              contact details.
            </Text>
          </ScrollView>
        )}

        <Text
          style={[styles.attribution, { color: colors.textMuted }]}
          numberOfLines={1}
        >
          Map data © OpenStreetMap contributors
        </Text>

        {loadingProviders ? (
          <View
            style={[
              styles.cardOverlay,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ProviderCardSkeleton />
          </View>
        ) : providerError ? (
          <View
            style={[
              styles.cardOverlay,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ProviderErrorCard
              message={providerError}
              onRetry={() => setReloadKey((key) => key + 1)}
            />
          </View>
        ) : null}
      </View>

      <ProviderDetails
        visible={!!selectedProviderId}
        providerId={selectedProviderId}
        provider={
          selectedProviderId ? (providers[selectedProviderId] ?? null) : null
        }
        origin={center}
        seedId={isSeed ? seedId : null}
        onClose={() => setSelectedProviderId(null)}
      />
    </View>
  );
}

function InfoPill({
  icon,
  text,
  color,
  background,
}: {
  icon: MdiName;
  text: string;
  color: string;
  background: string;
}) {
  return (
    <View style={[styles.infoPill, { backgroundColor: background }]}>
      <MaterialCommunityIcons name={icon} size={13} color={color} />
      <Text style={[styles.infoPillText, { color }]}>{text}</Text>
    </View>
  );
}

function ProviderCardSkeleton() {
  const { colors } = useAppTheme();
  return (
    <View style={styles.cardSkeleton}>
      <View style={styles.skeletonHeader}>
        <Skeleton width={42} height={42} radius={13} />
        <View style={styles.skeletonHeaderText}>
          <Skeleton width="55%" height={14} />
          <Skeleton width="82%" height={10} />
        </View>
      </View>
      <View style={styles.skeletonRow}>
        <Skeleton height={38} radius={10} style={styles.skeletonThird} />
        <Skeleton height={38} radius={10} style={styles.skeletonThird} />
        <Skeleton height={38} radius={10} style={styles.skeletonThird} />
      </View>
      <Skeleton height={38} radius={10} style={styles.skeletonGap} />
      <View style={styles.skeletonRow}>
        <Skeleton height={38} radius={10} style={styles.skeletonThird} />
        <Skeleton height={38} radius={10} style={styles.skeletonThird} />
      </View>
      <Skeleton height={48} radius={12} style={styles.skeletonGap} />
      <Text style={[styles.skeletonCaption, { color: colors.textMuted }]}>
        Loading providers…
      </Text>
    </View>
  );
}

function ProviderErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.cardSkeleton}>
      <View style={styles.errorHeader}>
        <View
          style={[
            styles.errorIcon,
            { backgroundColor: withAlpha(colors.danger, 0.14) },
          ]}
        >
          <MaterialCommunityIcons
            name="cloud-off-outline"
            size={23}
            color={colors.danger}
          />
        </View>
        <View style={styles.errorHeaderText}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Could not load providers
          </Text>
          <Text style={[styles.errorBody, { color: colors.textMuted }]}>
            The map works, but provider pins are hidden.
          </Text>
        </View>
      </View>

      <Text
        style={[styles.errorDetail, { color: colors.textMuted }]}
        numberOfLines={3}
      >
        {message}
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [
          styles.retryButton,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <MaterialCommunityIcons
          name="refresh"
          size={18}
          color={colors.onPrimary}
        />
        <Text style={[styles.retryText, { color: colors.onPrimary }]}>
          Try again
        </Text>
      </Pressable>

      <Text style={[styles.skeletonCaption, { color: colors.textMuted }]}>
        Check your connection or the Supabase project settings.
      </Text>
    </View>
  );
}

function MatchSkeleton() {
  const { colors } = useAppTheme();
  return (
    <View style={styles.matchSkeleton}>
      <Skeleton height={74} radius={14} />
      <Skeleton height={34} radius={10} />
      <Text style={[styles.skeletonCaption, { color: colors.textMuted }]}>
        Finding the best provider…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statusPill: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "600",
    flexShrink: 1,
  },
  crosshair: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -18,
    marginTop: -18,
  },
  crosshairRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  crosshairDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  providerPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.22,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  card: {
    position: "absolute",
    left: 12,
    right: 12,
    maxHeight: "48%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cardOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    justifyContent: "center",
    overflow: "hidden",
  },
  cardSkeleton: {
    gap: 0,
  },
  skeletonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  skeletonHeaderText: {
    flex: 1,
    gap: 7,
  },
  skeletonRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
  },
  skeletonThird: {
    flex: 1,
  },
  skeletonGap: {
    marginTop: 10,
  },
  skeletonCaption: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 10,
  },
  matchSkeleton: {
    marginTop: 12,
    gap: 8,
  },
  errorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  errorHeaderText: {
    flex: 1,
  },
  errorIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  errorBody: {
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 1,
    lineHeight: 16,
  },
  errorDetail: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 10,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 12,
  },
  retryText: {
    fontSize: 14,
    fontWeight: "800",
  },
  detailsHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 8,
  },
  detailsHint: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  pinHint: {
    fontSize: 10.5,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 12,
  },
  cardScroll: { flexGrow: 0 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderText: { flex: 1 },
  title: {
    fontSize: 16,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 2,
  },
  chips: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
  },
  chip: {
    flex: 1,
    flexDirection: "row",
    gap: 5,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  seedHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  seedLabel: {
    fontWeight: "700",
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
    paddingVertical: 2,
  },
  seeAllText: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  seedChips: {
    gap: 6,
    paddingVertical: 6,
    paddingRight: 4,
  },
  seedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  seedEmoji: {
    fontSize: 13,
  },
  seedChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  label: {
    fontWeight: "700",
    fontSize: 11.5,
    marginTop: 10,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    fontWeight: "600",
  },
  row: { flexDirection: "row", gap: 8 },
  half: { flex: 1 },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 14,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  bestCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
  },
  bestTag: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  bestName: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  infoPillText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  candidatesToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  candidatesToggleText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  candidateRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  candidateRank: {
    width: 22,
    fontWeight: "700",
    fontSize: 12,
  },
  candidateName: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "600",
    marginRight: 6,
  },
  candidateMeta: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  emptyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  attribution: {
    fontSize: 9.5,
    textAlign: "center",
    marginTop: 8,
  },
});
