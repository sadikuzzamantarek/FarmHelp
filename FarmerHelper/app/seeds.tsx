import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { withAlpha } from "@/constants/app-theme";
import { getSeedAccent, SEEDS } from "@/constants/seeds";
import { useAppTheme } from "@/contexts/app-theme";

/**
 * Seed catalogue: the "different page" a farmer sees after tapping Seed.
 * Choosing a variety opens the map already filtered to that seed.
 */
export default function SeedsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, mode, isDark } = useAppTheme();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const chooseSeed = (seedId: string) => {
    router.replace({
      pathname: "/map",
      params: { service: "seed", seed: seedId },
    });
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: insets.top + 12,
          paddingBottom: 36,
        }}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            onPress={goBack}
            style={[
              styles.backButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={22}
              color={colors.text}
            />
          </Pressable>

          <Text style={[styles.title, { color: colors.text }]}>Choose a seed</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Pick the seed you need. We show nearby providers with their price per
          kg and the real road distance.
        </Text>

        <View style={styles.list}>
          {SEEDS.map((seed) => {
            const accent = getSeedAccent(seed, mode);
            return (
              <Pressable
                key={seed.id}
                accessibilityRole="button"
                accessibilityLabel={`${seed.label}, ${seed.priceRange}. Find providers`}
                onPress={() => chooseSeed(seed.id)}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: pressed ? accent : colors.border,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <View
                  style={[
                    styles.emojiWrap,
                    { backgroundColor: withAlpha(accent, isDark ? 0.2 : 0.14) },
                  ]}
                >
                  <Text style={styles.emoji}>{seed.emoji}</Text>
                </View>

                <View style={styles.cardText}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {seed.label}
                  </Text>
                  <Text
                    style={[styles.cardBlurb, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {seed.blurb}
                  </Text>
                  <Text style={[styles.price, { color: accent }]}>
                    {seed.priceRange}
                  </Text>
                </View>

                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color={colors.textMuted}
                />
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.note, { color: colors.textMuted }]}>
          Prices are indicative demo ranges. Each provider sets its own price,
          and the map recalculates the best match for the seed you choose.
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
    marginBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  headerSpacer: { width: 44 },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 18,
  },
  list: {
    gap: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  emojiWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 27,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16.5,
    fontWeight: "800",
  },
  cardBlurb: {
    fontSize: 11.5,
    fontWeight: "500",
    marginTop: 1,
  },
  price: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  note: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 20,
  },
});
