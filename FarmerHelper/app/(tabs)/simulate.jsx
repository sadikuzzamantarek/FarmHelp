import React, { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { loadGeoContext, runGeoMatch } from "@/services/geoClient";

const SERVICE_TYPES = ["tractor", "sprayer", "seed"];

export default function SimulatorScreen() {
  // Data from API (Supabase or json-server, real coordinates)
  const [providers, setProviders] = useState(null);
  const [region, setRegion] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);

  // Farmer request state (lat/lng around Rangpur, Bangladesh)
  const [farmer, setFarmer] = useState({
    location: { lat: 23.8103, lng: 90.4125 },
    service_type: "tractor",
    acres: 5,
    kg_needed: 0,
    max_distance_km: 12,
    max_total_cost_tk: 2000,
    travel_cost_per_km_tk: 10,
  });

  // Result state
  const [result, setResult] = useState(null);
  const [isMatching, setIsMatching] = useState(false);

  // Load data on mount
  useEffect(() => {
    const load = async () => {
      try {
        const ctx = await loadGeoContext();
        setRegion(ctx.region);
        setSource(ctx.source);
        setProviders(ctx.providers);
        setFarmer((f) => ({ ...f, location: ctx.center }));
      } catch (error) {
        console.error("Failed to load data:", error.message);
        alert("Could not connect to the backend. Check json-server / .env.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Handler for changing farmer fields
  const updateFarmer = (key, value) => {
    setFarmer({ ...farmer, [key]: value });
    setResult(null); // clear old result
  };

  const updateLocation = (axis, value) => {
    setFarmer({
      ...farmer,
      location: { ...farmer.location, [axis]: Number(value) || 0 },
    });
    setResult(null);
  };

  // Run FarmMatch
  const runMatch = async () => {
    setIsMatching(true);
    try {
      setResult(await runGeoMatch(farmer, providers));
    } catch (error) {
      console.error("Match failed:", error.message);
      alert("Match failed: " + error.message);
    } finally {
      setIsMatching(false);
    }
  };

  // Helper to render a ranked candidate
  const renderCandidate = (candidate, index) => {
    const [score, provider, dist, cost] = candidate;
    return (
      <View key={index} style={styles.candidateItem}>
        <Text style={styles.rank}>{index + 1}.</Text>
        <Text style={styles.providerName}>{provider}</Text>
        <Text style={styles.detail}>Score: {score.toFixed(3)}</Text>
        <Text style={styles.detail}>Distance: {dist.toFixed(1)} km</Text>
        <Text style={styles.detail}>Total Cost: {cost.toFixed(0)} Tk</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text>Loading API data...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🚜 FarmMatch Simulator</Text>
      <Text style={styles.region}>
        {region} • {source}
      </Text>

      {/* Input fields */}
      <View style={styles.section}>
        <Text style={styles.label}>Location (lat, lng)</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex]}
            keyboardType="numeric"
            value={String(farmer.location.lat)}
            onChangeText={(text) => updateLocation("lat", text)}
            placeholder="Latitude"
          />
          <TextInput
            style={[styles.input, styles.flex]}
            keyboardType="numeric"
            value={String(farmer.location.lng)}
            onChangeText={(text) => updateLocation("lng", text)}
            placeholder="Longitude"
          />
        </View>

        <Text style={styles.label}>Service Type</Text>
        <Picker
          selectedValue={farmer.service_type}
          onValueChange={(itemValue) => updateFarmer("service_type", itemValue)}
          style={styles.picker}
        >
          {SERVICE_TYPES.map((type) => (
            <Picker.Item key={type} label={type.toUpperCase()} value={type} />
          ))}
        </Picker>

        {farmer.service_type !== "seed" ? (
          <>
            <Text style={styles.label}>Acres</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={String(farmer.acres)}
              onChangeText={(text) => updateFarmer("acres", Number(text) || 0)}
            />
          </>
        ) : (
          <>
            <Text style={styles.label}>Kg Needed</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={String(farmer.kg_needed)}
              onChangeText={(text) =>
                updateFarmer("kg_needed", Number(text) || 0)
              }
            />
          </>
        )}

        <Text style={styles.label}>Max Distance (km)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={String(farmer.max_distance_km)}
          onChangeText={(text) =>
            updateFarmer("max_distance_km", Number(text) || 0)
          }
        />

        <Text style={styles.label}>Max Total Cost (Tk)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={String(farmer.max_total_cost_tk)}
          onChangeText={(text) =>
            updateFarmer("max_total_cost_tk", Number(text) || 0)
          }
        />

        <Text style={styles.label}>Travel Cost per km (Tk)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={String(farmer.travel_cost_per_km_tk)}
          onChangeText={(text) =>
            updateFarmer("travel_cost_per_km_tk", Number(text) || 0)
          }
        />

        <Button
          title="🔍 Find Best Provider"
          onPress={runMatch}
          disabled={isMatching}
        />
        {isMatching && <ActivityIndicator style={{ marginTop: 10 }} />}
      </View>

      {/* Results */}
      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.subtitle}>✅ Match Result</Text>
          {result.success ? (
            <>
              <View style={styles.bestCard}>
                <Text style={styles.bestProvider}>{result.best_provider}</Text>
                <Text style={styles.bestDetail}>
                  Distance: {result.best_distance_km.toFixed(1)} km
                </Text>
                <Text style={styles.bestDetail}>
                  Total Cost: {result.best_total_cost_tk.toFixed(0)} Tk
                </Text>
                <Text style={styles.bestDetail}>
                  Time:{" "}
                  {(result.dijkstra_time_ms + result.ranking_time_ms).toFixed(
                    2,
                  )}{" "}
                  ms
                </Text>
              </View>
              <Text style={styles.subtitle}>Ranked Candidates</Text>
              {result.ranked_candidates.map(renderCandidate)}
            </>
          ) : (
            <Text style={styles.noMatch}>
              ❌ No eligible provider found. Try adjusting your criteria.
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#f5f5f5" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 4,
    textAlign: "center",
  },
  region: { textAlign: "center", fontSize: 13, color: "#666", marginBottom: 16 },
  row: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
  section: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  label: { fontWeight: "600", marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
  },
  picker: { height: 50, width: "100%" },
  resultContainer: { marginTop: 10 },
  subtitle: { fontSize: 20, fontWeight: "bold", marginVertical: 10 },
  bestCard: {
    backgroundColor: "#e8f5e9",
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  bestProvider: { fontSize: 22, fontWeight: "bold", color: "#2e7d32" },
  bestDetail: { fontSize: 16, marginTop: 4 },
  candidateItem: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  rank: { fontWeight: "bold", fontSize: 16 },
  providerName: { fontWeight: "600", fontSize: 16 },
  detail: { fontSize: 14, color: "#555" },
  noMatch: {
    fontSize: 18,
    color: "#c62828",
    textAlign: "center",
    marginVertical: 20,
  },
});