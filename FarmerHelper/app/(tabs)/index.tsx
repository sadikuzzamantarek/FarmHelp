import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ServiceTile } from "@/components/service-tile";
import { ThemeToggle } from "@/components/theme-toggle";
import { withAlpha } from "@/constants/app-theme";
import {
  SERVICES,
  getServiceAccent,
  type ServiceDefinition,
} from "@/constants/services";
import { useAppTheme } from "@/contexts/app-theme";

const H_PADDING = 16;
const GAP = 12;

const STEPS = [
  {
    icon: "gesture-tap" as const,
    title: "Pick a service",
    body: "Choose tractor, sprayer or seed.",
  },
  {
    icon: "map-search-outline" as const,
    title: "Compare nearby providers",
    body: "See price, distance and the road route.",
  },
  {
    icon: "calendar-check-outline" as const,
    title: "Book and track",
    body: "Booking and job tracking are coming next.",
    soon: true,
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, mode, isDark } = useAppTheme();

  const tileWidth = Math.min(
    240,
    Math.floor((width - H_PADDING * 2 - GAP) / 2),
  );

  const openService = (service: ServiceDefinition) => {
    // Seed opens the variety catalogue first; tractor/sprayer go straight to
    // the filtered map.
    if (service.id === "seed") {
      router.push({ pathname: "/seeds" });
      return;
    }
    router.push({
      pathname: "/map",
      params: { service: service.id },
    });
  };

  const showComingSoon = () => {
    Alert.alert(
      "More services coming",
      "Harvester, labour, transport and other services will be added here one by one.",
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: H_PADDING,
          paddingTop: insets.top + 12,
          paddingBottom: 40,
        }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View
              style={[
                styles.brandMark,
                { backgroundColor: colors.primarySoft },
              ]}
            >
              <MaterialCommunityIcons
                name="sprout"
                size={22}
                color={colors.primary}
              />
            </View>
            <View>
              <Text style={[styles.brand, { color: colors.text }]}>
                FarmHelper
              </Text>
              <View style={styles.locationRow}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={12}
                  color={colors.textMuted}
                />
                <Text style={[styles.location, { color: colors.textMuted }]}>
                  Rangpur, Bangladesh
                </Text>
              </View>
            </View>
          </View>
          <ThemeToggle />
        </View>

        {/* Hero */}
        <View
          style={[styles.hero, { backgroundColor: colors.primarySoft }]}
        >
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            What do you need today?
          </Text>
          <Text style={[styles.heroBody, { color: colors.textMuted }]}>
            Choose a service. We show nearby providers with their price and the
            real road distance to your land.
          </Text>
          <View
            style={[
              styles.heroBadge,
              { backgroundColor: withAlpha(colors.primary, isDark ? 0.2 : 0.14) },
            ]}
          >
            <MaterialCommunityIcons
              name="road-variant"
              size={13}
              color={colors.primary}
            />
            <Text style={[styles.heroBadgeText, { color: colors.primary }]}>
              Road-distance matching
            </Text>
          </View>
        </View>

        {/* Services */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Services
          </Text>
          <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>
            {SERVICES.length} available
          </Text>
        </View>

        <View style={styles.grid}>
          {SERVICES.map((service) => (
            <ServiceTile
              key={service.id}
              service={service}
              width={tileWidth}
              onPress={() => openService(service)}
            />
          ))}

          {/* Extensibility is visible: new services land in this grid. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More services coming soon"
            onPress={showComingSoon}
            style={({ pressed }) => [
              styles.moreTile,
              {
                width: tileWidth,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.chip : "transparent",
              },
            ]}
          >
            <View
              style={[
                styles.moreIcon,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <MaterialCommunityIcons
                name="plus"
                size={26}
                color={colors.textMuted}
              />
            </View>
            <Text style={[styles.moreTitle, { color: colors.text }]}>
              More services
            </Text>
            <Text style={[styles.moreBody, { color: colors.textMuted }]}>
              Harvester, labour, transport…
            </Text>
          </Pressable>
        </View>

        {/* How it works */}
        <View
          style={[
            styles.howCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.howTitle, { color: colors.text }]}>
            How it works
          </Text>
          {STEPS.map((step, index) => {
            const stepColor =
              index === 0
                ? getServiceAccent(SERVICES[0], mode)
                : index === 1
                  ? getServiceAccent(SERVICES[1], mode)
                  : getServiceAccent(SERVICES[2], mode);
            return (
              <View key={step.title} style={styles.stepRow}>
                <View
                  style={[
                    styles.stepIcon,
                    {
                      backgroundColor: withAlpha(
                        stepColor,
                        isDark ? 0.2 : 0.14,
                      ),
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={step.icon}
                    size={18}
                    color={stepColor}
                  />
                </View>
                <View style={styles.stepText}>
                  <View style={styles.stepTitleRow}>
                    <Text style={[styles.stepTitle, { color: colors.text }]}>
                      {step.title}
                    </Text>
                    {step.soon ? (
                      <View
                        style={[
                          styles.soonBadge,
                          { backgroundColor: colors.accentSoft },
                        ]}
                      >
                        <Text
                          style={[styles.soonText, { color: colors.accent }]}
                        >
                          SOON
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.stepBody, { color: colors.textMuted }]}>
                    {step.body}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <Text style={[styles.footnote, { color: colors.textMuted }]}>
          Demo data · Provider records are synthetic test data. Map data ©
          OpenStreetMap contributors.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  location: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  hero: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 22,
  },
  heroTitle: {
    fontSize: 25,
    fontWeight: "800",
    lineHeight: 31,
    letterSpacing: -0.3,
  },
  heroBody: {
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 6,
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 12,
  },
  heroBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  sectionMeta: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
    marginBottom: 24,
  },
  moreTile: {
    minHeight: 176,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    padding: 14,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  moreIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  moreTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  moreBody: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 3,
  },
  howCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 18,
  },
  howTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  stepIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { flex: 1, paddingTop: 1 },
  stepTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepTitle: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  stepBody: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
  },
  soonBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  soonText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  footnote: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    paddingHorizontal: 8,
  },
});
