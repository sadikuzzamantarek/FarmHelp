import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Constants from "expo-constants";
import React, { Component, Suspense, type ReactNode } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/contexts/app-theme";
import { Skeleton } from "@/components/skeleton";

/**
 * The real map lives outside `app/` because `@maplibre/maplibre-react-native`
 * is a native module. Importing it eagerly crashes the whole app in Expo Go
 * (and on web), taking every other route down with it.
 *
 * Loading it lazily means: Home and Simulator keep working, and the Map tab
 * shows a clear "development build required" notice instead of an
 * Invariant Violation.
 */
const IS_EXPO_GO = Constants.executionEnvironment === "storeClient";
const CAN_LOAD_NATIVE_MAP = !IS_EXPO_GO && Platform.OS !== "web";

const MapScreen = CAN_LOAD_NATIVE_MAP
  ? React.lazy(() => import("../../features/map/map-screen"))
  : null;

type BoundaryProps = {
  children: ReactNode;
  fallback: (error: Error) => ReactNode;
};

type BoundaryState = { error: Error | null };

class MapLoadBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) return this.props.fallback(this.state.error);
    return this.props.children;
  }
}

function MapLoading() {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.chip }]}
      />

      <View style={styles.loadingTop}>
        <Skeleton width={150} height={30} radius={15} />
      </View>

      <View
        style={[
          styles.loadingCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.loadingHeader}>
          <Skeleton width={42} height={42} radius={13} />
          <View style={styles.loadingHeaderText}>
            <Skeleton width="55%" height={14} />
            <Skeleton width="82%" height={10} />
          </View>
        </View>

        <View style={styles.loadingRow}>
          <Skeleton height={38} radius={10} style={styles.loadingThird} />
          <Skeleton height={38} radius={10} style={styles.loadingThird} />
          <Skeleton height={38} radius={10} style={styles.loadingThird} />
        </View>
        <Skeleton height={38} radius={10} style={styles.loadingGap} />
        <Skeleton height={48} radius={12} style={styles.loadingGap} />

        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Loading map…
        </Text>
      </View>
    </View>
  );
}

/** Shown when MapLibre is not in the current binary (Expo Go / web / old build). */
function MapUnavailable({ error }: { error: Error }) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const reason = IS_EXPO_GO
    ? "You are running in Expo Go. MapLibre is a native module, so it only exists in FarmerHelper's own development build — not in Expo Go."
    : Platform.OS === "web"
      ? "The map uses a native module, so it is not available in the web preview. Open the app in the Android development build."
      : "This installed app does not include the MapLibre native module. Rebuild it once and the map will work.";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.noticeContent,
        { paddingTop: insets.top + 28 },
      ]}
    >
      <View
        style={[styles.noticeIcon, { backgroundColor: colors.accentSoft }]}
      >
        <MaterialCommunityIcons
          name="map-marker-off-outline"
          size={30}
          color={colors.accent}
        />
      </View>

      <Text style={[styles.noticeTitle, { color: colors.text }]}>
        The map needs a development build
      </Text>

      <Text style={[styles.noticeBody, { color: colors.textMuted }]}>
        {reason}
      </Text>

      <View
        style={[
          styles.stepsCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.step, { color: colors.text }]}>
          1. Close Expo Go.
        </Text>
        <Text style={[styles.step, { color: colors.text }]}>
          2. In the project folder, run:
        </Text>
        <View style={[styles.codeBlock, { backgroundColor: colors.chip }]}>
          <Text style={[styles.code, { color: colors.primary }]}>
            npm run android
          </Text>
        </View>
        <Text style={[styles.step, { color: colors.text }]}>
          3. Open the installed FarmerHelper app and tap Find.
        </Text>
      </View>

      <Text style={[styles.noticeHint, { color: colors.textMuted }]}>
        Home, the service tiles and the Simulator keep working without the map.
      </Text>

      {__DEV__ ? (
        <Text style={[styles.debug, { color: colors.textMuted }]}>
          Technical detail: {error.message}
        </Text>
      ) : null}
    </ScrollView>
  );
}

export default function MapRoute() {
  if (!MapScreen) {
    return (
      <MapUnavailable
        error={new Error("MapLibre is unavailable in this environment")}
      />
    );
  }

  return (
    <MapLoadBoundary fallback={(error) => <MapUnavailable error={error} />}>
      <Suspense fallback={<MapLoading />}>
        <MapScreen />
      </Suspense>
    </MapLoadBoundary>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loadingTop: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    alignItems: "flex-start",
  },
  loadingCard: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 24,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  loadingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingHeaderText: {
    flex: 1,
    gap: 7,
  },
  loadingRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 14,
  },
  loadingThird: {
    flex: 1,
  },
  loadingGap: {
    marginTop: 10,
  },
  loadingText: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 10,
    textAlign: "center",
  },
  noticeContent: {
    paddingHorizontal: 22,
    paddingBottom: 32,
  },
  noticeIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  noticeTitle: {
    fontSize: 23,
    fontWeight: "800",
    lineHeight: 29,
  },
  noticeBody: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  stepsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 18,
    gap: 8,
  },
  step: {
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: "600",
  },
  codeBlock: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 2,
  },
  code: {
    fontFamily: "monospace",
    fontSize: 14,
    fontWeight: "700",
  },
  noticeHint: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 16,
  },
  debug: {
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 18,
  },
});
