import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { useAppTheme } from "@/contexts/app-theme";

type ThemeToggleProps = {
  style?: StyleProp<ViewStyle>;
  /** Slightly smaller button for floating map controls */
  compact?: boolean;
};

/** One-tap light/dark switch. Remembered on web, session-only on native. */
export function ThemeToggle({ style, compact = false }: ThemeToggleProps) {
  const { isDark, toggle, colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={
        isDark ? "Switch to light theme" : "Switch to dark theme"
      }
      accessibilityHint="Changes the app colours"
      hitSlop={8}
      onPress={toggle}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.shadow,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <MaterialCommunityIcons
        name={isDark ? "weather-night" : "weather-sunny"}
        size={compact ? 20 : 22}
        color={isDark ? colors.accent : colors.primary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  compact: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});
