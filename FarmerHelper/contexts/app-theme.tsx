import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";

import {
  AppColors,
  type AppPalette,
  type ThemeMode,
} from "@/constants/app-theme";

const STORAGE_KEY = "farmhelper.theme";

type ThemeStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

/** Web keeps the choice across reloads; native has no storage dependency yet. */
function getStorage(): ThemeStorage | null {
  try {
    const scope = globalThis as unknown as { localStorage?: ThemeStorage };
    return scope.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStoredMode(): ThemeMode | null {
  try {
    const value = getStorage()?.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

type AppThemeContextValue = {
  /** Resolved theme actually being rendered */
  mode: ThemeMode;
  isDark: boolean;
  colors: AppPalette;
  /** Explicit override; `null` means "follow the phone setting" */
  preference: ThemeMode | null;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  // `null` = no explicit choice yet, follow the device.
  const [preference, setPreference] = useState<ThemeMode | null>(() =>
    readStoredMode(),
  );
  const systemScheme = useColorScheme();
  const mode: ThemeMode =
    preference ?? (systemScheme === "dark" ? "dark" : "light");

  const setMode = useCallback((next: ThemeMode) => {
    setPreference(next);
    try {
      getStorage()?.setItem(STORAGE_KEY, next);
    } catch {
      // Storage is best-effort: the toggle still works for this session.
    }
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      mode,
      isDark: mode === "dark",
      colors: AppColors[mode],
      preference,
      setMode,
      toggle,
    }),
    [mode, preference, setMode, toggle],
  );

  return (
    <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>
  );
}

export function useAppTheme(): AppThemeContextValue {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used inside <AppThemeProvider>");
  }
  return context;
}
