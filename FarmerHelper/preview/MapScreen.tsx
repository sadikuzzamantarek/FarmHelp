import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
} from "@maplibre/maplibre-react-native";

import {
  DEFAULT_CENTER,
  loadGeoContext,
  runGeoMatch,
} from "../services/geoClient";

const OSM_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const SERVICE_TYPES = ["tractor", "sprayer", "seed"];

/**
 * MapLibre + OpenFreeMap farm-matching screen (no API key).
 * Never blocks: renders Rangpur center immediately and loads provider
 * markers in the background from Supabase or json-server.
 *
 * Copy this file into app/(tabs)/map.tsx after running a development build
 * (MapLibre is NOT available in Expo Go).
 */
export default function MapScreen() {
  const mapRef = useRef<any>(null);

  const [providers, setProviders] = useState<any>({});
  const [center, setCenter] = useState<any>(DEFAULT_CENTER);
  const [result, setResult] = useState<any>(null);
  const [status, setStatus] = useState("Connecting to backend...");
  const [expanded, setExpanded] = useState(true);
  const [showCandidates, setShowCandidates] = useState(false);

  // Farmer request options
  const [serviceType, setServiceType] = useState("tractor");
  const [acres, setAcres] = useState("5");
  const [kgNeeded, setKgNeeded] = useState("20");
  const [maxDistanceKm, setMaxDistanceKm] = useState("12");
  const [maxTotalCostTk, setMaxTotalCostTk] = useState("2000");
  const [travelCostPerKm, setTravelCostPerKm] = useState("10");

  useEffect(() => {
    const load = async () => {
      try {
        const ctx = await loadGeoContext();
        setProviders(ctx.providers ?? {});
        setCenter(ctx.center);
        setStatus(ctx.source);
      } catch (error: any) {
        console.error("Backend unavailable:", error.message);
        setStatus("Backend unreachable — showing map only");
      }
    };
    load();
  }, []);

  const onRegionDidChange = async () => {
    const c = await mapRef.current?.getCenter(); // [lng, lat]
    if (c) setCenter({ lat: c[1], lng: c[0] });
  };

  const runMatch = async () => {
    if (!center) return;
    const req = {
      location: center,
      service_type: serviceType,
      acres: Number(acres) || 0,
      kg_needed: Number(kgNeeded) || 0,
      max_distance_km: Number(maxDistanceKm) || 0,
      max_total_cost_tk: Number(maxTotalCostTk) || 0,
      travel_cost_per_km_tk: Number(travelCostPerKm) || 0,
    };
    try {
      setResult(await runGeoMatch(req, providers));
      setShowCandidates(true);
    } catch (error: any) {
      setStatus("Match failed: " + error.message);
    }
  };

  const isSeed = serviceType === "seed";
  const best = result?.success ? providers[result.best_provider] : null;
  const route: GeoJSON.Feature | null =
    best && center
      ? {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
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
        mapStyle={OSM_STYLE}
        onRegionDidChange={onRegionDidChange}
        style={styles.flex}
      >
        <Camera
          initialViewState={{ center: [center.lng, center.lat], zoom: 11 }}
        />

        {Object.entries(providers).map(([id, p]: [string, any]) => (
          <Marker key={id} lngLat={[p.lng, p.lat]} anchor="bottom">
            <View style={styles.providerPin}>
              <Text style={styles.pinText}>🚜</Text>
            </View>
          </Marker>
        ))}

        {route && (
          <GeoJSONSource id="route" data={route}>
            <Layer
              id="route-layer"
              type="line"
              style={{
                lineColor: "#1565c0",
                lineWidth: 4,
                lineDasharray: [4, 2],
              }}
            />
          </GeoJSONSource>
        )}
      </Map>

      {/* Backend status badge */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{status}</Text>
      </View>

      {/* Fixed farmer crosshair = map center */}
      <View pointerEvents="none" style={styles.crosshair}>
        <Text style={styles.crosshairDot}>📍</Text>
      </View>

      {/* Options + result card */}
      <View style={styles.card}>
        <Pressable
          onPress={() => setExpanded(!expanded)}
          style={styles.cardHeader}
        >
          <View style={styles.cardHeaderText}>
            <Text style={styles.title}>Booking options</Text>
            {result?.success ? (
              <Text style={styles.headerBest} numberOfLines={1}>
                Best: {result.best_provider} • {result.best_distance_km.toFixed(1)}{" "}
                km • {result.best_total_cost_tk.toFixed(0)} Tk
              </Text>
            ) : (
              <Text style={styles.coords}>
                {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
              </Text>
            )}
          </View>
          <Text style={styles.chevron}>{expanded ? "▼" : "▲"}</Text>
        </Pressable>

        {expanded && (
          <ScrollView
            style={styles.cardScroll}
            keyboardShouldPersistTaps="handled"
          >
          <Text style={styles.label}>Service type</Text>
          <View style={styles.chips}>
            {SERVICE_TYPES.map((t) => (
              <Pressable
                key={t}
                style={[styles.chip, serviceType === t && styles.chipActive]}
                onPress={() => setServiceType(t)}
              >
                <Text
                  style={[
                    styles.chipText,
                    serviceType === t && styles.chipTextActive,
                  ]}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {isSeed ? (
            <>
              <Text style={styles.label}>Kg needed</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={kgNeeded}
                onChangeText={setKgNeeded}
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>Acres</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={acres}
                onChangeText={setAcres}
              />
            </>
          )}

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Max distance (km)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={maxDistanceKm}
                onChangeText={setMaxDistanceKm}
              />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Travel cost / km (Tk)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={travelCostPerKm}
                onChangeText={setTravelCostPerKm}
              />
            </View>
          </View>

          <Text style={styles.label}>Max total cost (Tk)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={maxTotalCostTk}
            onChangeText={setMaxTotalCostTk}
          />

          <Button title="Find best provider" onPress={runMatch} />

          {result?.success ? (
            <>
              <Text style={styles.best}>
                Best: {result.best_provider} — {result.best_distance_km.toFixed(1)}{" "}
                km • {result.best_total_cost_tk.toFixed(0)} Tk
              </Text>
              <Pressable
                onPress={() => setShowCandidates(!showCandidates)}
                style={styles.candidatesToggle}
              >
                <Text style={styles.candidatesToggleText}>
                  {showCandidates ? "Hide" : "Show"} all{" "}
                  {result.ranked_candidates.length} eligible providers{" "}
                  {showCandidates ? "▲" : "▼"}
                </Text>
              </Pressable>
              {showCandidates &&
                (result.ranked_candidates as any[]).map(
                  (line: any, i: number) => {
                    const [, name, dist, cost] = line;
                    return (
                      <View
                        key={name + i}
                        style={[
                          styles.candidateRow,
                          i === 0 && styles.candidateRowBest,
                        ]}
                      >
                        <Text style={styles.candidateRank}>{i + 1}.</Text>
                        <Text style={styles.candidateName} numberOfLines={1}>
                          {name}
                        </Text>
                        <Text style={styles.candidateMeta}>
                          {dist.toFixed(1)} km • {cost.toFixed(0)} Tk
                        </Text>
                      </View>
                    );
                  },
                )}
            </>
          ) : result ? (
            <Text style={styles.none}>No eligible provider.</Text>
          ) : null}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  badge: {
    position: "absolute",
    top: 16,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: { color: "#fff", fontSize: 12 },
  crosshair: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -16,
    marginTop: -28,
  },
  crosshairDot: { fontSize: 32 },
  providerPin: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  pinText: { fontSize: 16 },
  card: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    maxHeight: "48%",
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 10,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  cardScroll: { flexGrow: 0 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHeaderText: { flex: 1, paddingRight: 8 },
  chevron: { fontSize: 14, color: "#2e7d32", padding: 4 },
  headerBest: { fontSize: 12, color: "#2e7d32", fontWeight: "600" },
  title: { fontWeight: "700", marginBottom: 2 },
  coords: { fontSize: 13, color: "#555", marginBottom: 6 },
  label: { fontWeight: "600", fontSize: 12, marginTop: 6, marginBottom: 2 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 6,
    fontSize: 13,
  },
  picker: { height: 44, width: "100%" },
  chips: { flexDirection: "row", gap: 6 },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  chipActive: { backgroundColor: "#2e7d32", borderColor: "#2e7d32" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#333" },
  chipTextActive: { color: "#fff" },
  row: { flexDirection: "row", gap: 8 },
  half: { flex: 1 },
  best: { marginTop: 10, color: "#2e7d32", fontWeight: "700" },
  candidatesToggle: {
    marginTop: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  candidatesToggleText: { fontSize: 13, color: "#1565c0", fontWeight: "600" },
  candidateRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  candidateRowBest: { backgroundColor: "#e8f5e9" },
  candidateRank: { width: 22, fontWeight: "700", fontSize: 13 },
  candidateName: { flex: 1, fontSize: 13, marginRight: 6 },
  candidateMeta: { fontSize: 12, color: "#555" },
  candidates: { fontSize: 12, color: "#555", marginTop: 2 },
  none: { marginTop: 10, color: "#c62828" },
});