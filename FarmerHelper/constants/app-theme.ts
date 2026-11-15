/**
 * FarmHelper app palette.
 *
 * These colours are intentionally separate from `constants/theme.ts` (the Expo
 * template palette). The template palette is still used by the remaining
 * template components; new screens should use `useAppTheme()` from
 * `contexts/app-theme.tsx` so light/dark switching works everywhere.
 */

export type ThemeMode = "light" | "dark";

export type AppPalette = {
  /** Page background */
  background: string;
  /** Cards, sheets, tab bar */
  surface: string;
  /** Raised chips / inputs */
  elevated: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  danger: string;
  chip: string;
  shadow: string;
  overlay: string;
};

export const AppColors: Record<ThemeMode, AppPalette> = {
  light: {
    background: "#F3F7EE",
    surface: "#FFFFFF",
    elevated: "#F7FAF4",
    text: "#152212",
    textMuted: "#5E6E58",
    border: "#DFE8D7",
    primary: "#2E7D32",
    onPrimary: "#FFFFFF",
    primarySoft: "#E5F2E2",
    accent: "#C77700",
    accentSoft: "#FBF0DC",
    danger: "#B3261E",
    chip: "#EDF3E8",
    shadow: "#12200D",
    overlay: "rgba(15, 30, 12, 0.62)",
  },
  dark: {
    background: "#0E1510",
    surface: "#161F18",
    elevated: "#1C2720",
    text: "#EEF4EA",
    textMuted: "#9CAC97",
    border: "#29372C",
    primary: "#7FD08A",
    onPrimary: "#0A2410",
    primarySoft: "#1D2F22",
    accent: "#F5C05A",
    accentSoft: "#2C2415",
    danger: "#FF8A80",
    chip: "#202C23",
    shadow: "#000000",
    overlay: "rgba(0, 0, 0, 0.66)",
  },
};

/**
 * Add an alpha channel to a `#RRGGBB` colour.
 * Returns the input unchanged when it is already rgba()/named.
 */
export function withAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
