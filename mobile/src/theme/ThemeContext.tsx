import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AccessibilityInfo, useColorScheme, useWindowDimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  TABLET_MIN_WIDTH,
  darkColors,
  lightColors,
  type ColorTokens,
  type ThemeMode,
} from "./tokens";

const THEME_PREF_KEY = "bb-mobile-theme";

type ThemePreference = "system" | ThemeMode;

type ThemeContextValue = {
  colors: ColorTokens;
  mode: ThemeMode;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  isTablet: boolean;
  reduceTransparency: boolean;
  reduceMotion: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const { width } = useWindowDimensions();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [hydrated, setHydrated] = useState(false);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_PREF_KEY);
        if (
          !cancelled &&
          (stored === "system" || stored === "light" || stored === "dark")
        ) {
          setPreferenceState(stored);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const subTransparency = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparency
    );
    const subMotion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion
    );
    AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    return () => {
      subTransparency.remove();
      subMotion.remove();
    };
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    void AsyncStorage.setItem(THEME_PREF_KEY, pref);
  }, []);

  const mode: ThemeMode =
    preference === "system" ? (system === "dark" ? "dark" : "light") : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: mode === "dark" ? darkColors : lightColors,
      mode,
      preference: hydrated ? preference : "system",
      setPreference,
      isTablet: width >= TABLET_MIN_WIDTH,
      reduceTransparency,
      reduceMotion,
    }),
    [
      mode,
      preference,
      hydrated,
      setPreference,
      width,
      reduceTransparency,
      reduceMotion,
    ]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
