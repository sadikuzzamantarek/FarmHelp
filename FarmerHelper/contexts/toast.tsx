import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/contexts/app-theme";

export type ToastKind = "success" | "error" | "warning" | "info";

type ToastState = {
  id: number;
  message: string;
  kind: ToastKind;
};

type ToastContextValue = {
  showToast: (message: string, kind?: ToastKind, durationMs?: number) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = {
  success: "check-circle",
  error: "alert-circle",
  warning: "alert",
  info: "information",
} as const;

/**
 * App-wide, non-blocking feedback. Use it for anything the farmer needs to
 * know that is not a full screen: match success, no results, degraded mode,
 * input problems. Nothing should fail silently.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const [toast, setToast] = useState<ToastState | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastIdRef = useRef(0);

  const hideToast = useCallback(() => {
    const id = toastIdRef.current;
    Animated.timing(progress, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && toastIdRef.current === id) setToast(null);
    });
  }, [progress]);

  const showToast = useCallback(
    (message: string, kind: ToastKind = "info", durationMs?: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      const id = Date.now();
      toastIdRef.current = id;
      setToast({ id, message, kind });
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();

      const duration =
        durationMs ?? (kind === "error" ? 4800 : kind === "warning" ? 4000 : 3000);
      timerRef.current = setTimeout(hideToast, duration);
    },
    [hideToast, progress],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const value = useMemo(() => ({ showToast, hideToast }), [showToast, hideToast]);

  const tone =
    toast?.kind === "error"
      ? colors.danger
      : toast?.kind === "warning"
        ? colors.accent
        : colors.primary;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View
          pointerEvents="box-none"
          style={[styles.host, { bottom: insets.bottom + 76 }]}
        >
          <Animated.View
            style={{
              width: "100%",
              opacity: progress,
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            }}
          >
            <Pressable
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              onPress={hideToast}
              style={[
                styles.toast,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderLeftColor: tone,
                  shadowColor: colors.shadow,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={ICONS[toast.kind]}
                size={21}
                color={tone}
              />
              <Text style={[styles.message, { color: colors.text }]}>
                {toast.message}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 12,
    right: 12,
    alignItems: "center",
    zIndex: 100,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: 12,
    paddingVertical: 11,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  message: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
});
