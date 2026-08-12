export type ThemeMode = "light" | "dark";

export interface ColorTokens {
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  success: string;
  successForeground: string;
  destructive: string;
  destructiveForeground: string;
  ring: string;
  tabBarGlass: string;
  tabBarBorder: string;
  overlay: string;
}

export const lightColors: ColorTokens = {
  primary: "#1E40AF",
  primaryForeground: "#FFFFFF",
  accent: "#EA580C",
  accentForeground: "#FFFFFF",
  background: "#F5F7FB",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  foreground: "#0F172A",
  muted: "#E9EEF6",
  mutedForeground: "#64748B",
  border: "#E2E8F0",
  success: "#059669",
  successForeground: "#FFFFFF",
  destructive: "#DC2626",
  destructiveForeground: "#FFFFFF",
  ring: "#1E40AF",
  tabBarGlass: "rgba(255, 255, 255, 0.72)",
  tabBarBorder: "rgba(226, 232, 240, 0.85)",
  overlay: "rgba(15, 23, 42, 0.45)",
};

export const darkColors: ColorTokens = {
  primary: "#60A5FA",
  primaryForeground: "#0B1220",
  accent: "#FB923C",
  accentForeground: "#0B1220",
  background: "#0B0F17",
  surface: "#141A24",
  surfaceElevated: "#1A2230",
  foreground: "#F1F5F9",
  muted: "#1E293B",
  mutedForeground: "#94A3B8",
  border: "#1E293B",
  success: "#34D399",
  successForeground: "#052E16",
  destructive: "#F87171",
  destructiveForeground: "#450A0A",
  ring: "#60A5FA",
  tabBarGlass: "rgba(20, 26, 36, 0.78)",
  tabBarBorder: "rgba(30, 41, 59, 0.9)",
  overlay: "rgba(0, 0, 0, 0.55)",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const TABLET_MIN_WIDTH = 768;
export const SIDEBAR_WIDTH = 260;
