import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { withAlpha } from "@/constants/app-theme";
import {
  getServiceAccent,
  type ServiceDefinition,
} from "@/constants/services";
import { useAppTheme } from "@/contexts/app-theme";

type ServiceTileProps = {
  service: ServiceDefinition;
  width: number;
  onPress: () => void;
};

/**
 * A large, icon-first tile for the Home grid. Designed for low-literacy
 * farmers: icon + short label + one-line explanation + clear arrow.
 */
export function ServiceTile({ service, width, onPress }: ServiceTileProps) {
  const { colors, mode, isDark } = useAppTheme();
  const accent = getServiceAccent(service, mode);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${service.label}. ${service.blurb}.`}
      accessibilityHint={
        service.id === "seed"
          ? "Opens the seed catalogue"
          : `Opens the map and shows nearby ${service.label.toLowerCase()} providers`
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          width,
          backgroundColor: colors.surface,
          borderColor: pressed ? accent : colors.border,
          shadowColor: colors.shadow,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: withAlpha(accent, isDark ? 0.2 : 0.14) },
        ]}
      >
        <MaterialCommunityIcons name={service.icon} size={32} color={accent} />
      </View>

      <Text style={[styles.label, { color: colors.text }]}>{service.label}</Text>
      <Text
        style={[styles.blurb, { color: colors.textMuted }]}
        numberOfLines={2}
      >
        {service.blurb}
      </Text>

      <View style={styles.footer}>
        <Text style={[styles.unit, { color: accent }]}>
          per {service.unitLabel === "kg" ? "kg" : "acre"}
        </Text>
        <MaterialCommunityIcons
          name="arrow-right"
          size={18}
          color={colors.textMuted}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    minHeight: 176,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  label: {
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  blurb: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 4,
    minHeight: 34,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  unit: {
    fontSize: 12,
    fontWeight: "700",
  },
});
