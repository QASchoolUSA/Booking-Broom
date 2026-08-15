import React, { memo, useEffect, useMemo, useRef } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import {
  GlassView,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CalendarDays,
  MessageSquare,
  Mail,
  LayoutGrid,
  Settings,
} from "lucide-react-native";
import { useTheme } from "@/theme";
import { radius } from "@/theme/tokens";
import { AppText } from "@/components/ui";
import { useChrome } from "@/components/chrome/ChromeContext";

const ICONS = {
  bookings: CalendarDays,
  messages: MessageSquare,
  email: Mail,
  ops: LayoutGrid,
  settings: Settings,
} as const;

const STACK_TABS = new Set(["bookings", "messages", "email"]);

/** Compatible with Expo Router's custom tabBar render props. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TabBarRenderProps = any;

function nestedIndex(route: { state?: { index?: number } } | undefined) {
  return route?.state?.index ?? 0;
}

function LiquidGlassTabBarComponent({
  state,
  descriptors,
  navigation,
}: TabBarRenderProps) {
  const insets = useSafeAreaInsets();
  const { colors, mode, reduceTransparency } = useTheme();
  const { hideTabBar, setHideTabBar } = useChrome();
  const prevTab = useRef(state.index);

  useEffect(() => {
    if (prevTab.current === state.index) return;
    prevTab.current = state.index;
    const route = state.routes[state.index];
    setHideTabBar(nestedIndex(route) > 0);
  }, [state.index, state.routes, setHideTabBar]);

  const liquidGlass =
    !reduceTransparency &&
    Platform.OS === "ios" &&
    isLiquidGlassAvailable();
  const useBlur =
    !liquidGlass && !reduceTransparency && Platform.OS === "ios";

  const containerStyle = useMemo(
    () => [
      styles.wrap,
      {
        bottom: Math.max(insets.bottom, 10) + 4,
        borderColor: colors.tabBarBorder,
        backgroundColor:
          liquidGlass || useBlur ? "transparent" : colors.tabBarGlass,
        transform: [{ translateY: hideTabBar ? 120 : 0 }],
        shadowOpacity: hideTabBar ? 0 : 0.18,
        elevation: hideTabBar ? 0 : 10,
      },
    ],
    [
      insets.bottom,
      colors.tabBarBorder,
      colors.tabBarGlass,
      liquidGlass,
      useBlur,
      hideTabBar,
    ]
  );

  const glassBackground = liquidGlass ? (
    <GlassView
      style={StyleSheet.absoluteFill}
      glassEffectStyle="regular"
      colorScheme={mode === "dark" ? "dark" : "light"}
      isInteractive={false}
      pointerEvents="none"
    />
  ) : useBlur ? (
    <>
      <BlurView
        intensity={mode === "dark" ? 48 : 62}
        tint={mode === "dark" ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.tabBarGlass },
        ]}
        pointerEvents="none"
      />
    </>
  ) : (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: colors.tabBarGlass },
      ]}
      pointerEvents="none"
    />
  );

  return (
    <View
      collapsable={false}
      style={containerStyle}
      pointerEvents={hideTabBar ? "none" : "box-none"}
    >
      {glassBackground}
      <View style={styles.row} pointerEvents="box-none">
        {state.routes.map(
          (
            route: { key: string; name: string; params?: object },
            index: number
          ) => {
            const focused = state.index === index;
            const { options } = descriptors[route.key];
            const label =
              typeof options.tabBarLabel === "string"
                ? options.tabBarLabel
                : options.title ?? route.name;
            const iconKey = route.name as keyof typeof ICONS;
            const Icon = ICONS[iconKey] ?? LayoutGrid;
            const color = focused ? colors.primary : colors.mutedForeground;
            const badge = options.tabBarBadge;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (event.defaultPrevented) return;

              if (STACK_TABS.has(route.name)) {
                navigation.navigate(route.name, { screen: "index" });
                return;
              }

              if (typeof navigation.jumpTo === "function") {
                navigation.jumpTo(route.name, route.params);
                return;
              }

              if (!focused) {
                navigation.navigate(route.name, route.params);
              }
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                onPress={onPress}
                style={styles.item}
                hitSlop={4}
              >
                <View
                  style={[
                    styles.iconWrap,
                    focused && {
                      backgroundColor:
                        mode === "dark"
                          ? "rgba(96, 165, 250, 0.18)"
                          : "rgba(30, 64, 175, 0.12)",
                    },
                  ]}
                >
                  <Icon
                    size={20}
                    color={color}
                    strokeWidth={focused ? 2.4 : 2}
                  />
                  {badge != null && badge !== false ? (
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: colors.destructive },
                      ]}
                    >
                      <AppText
                        size={8}
                        weight="bold"
                        style={{ color: colors.destructiveForeground }}
                      >
                        {String(badge)}
                      </AppText>
                    </View>
                  ) : null}
                </View>
                <AppText
                  size={10}
                  weight={focused ? "semibold" : "medium"}
                  style={{ color, marginTop: 1 }}
                  numberOfLines={1}
                >
                  {label}
                </AppText>
              </Pressable>
            );
          }
        )}
      </View>
    </View>
  );
}

export const LiquidGlassTabBar = memo(LiquidGlassTabBarComponent);

function PhoneTabBar(props: TabBarRenderProps) {
  return <LiquidGlassTabBar {...props} />;
}

function HiddenTabBar() {
  return null;
}

export function tabsBarRenderer(isTablet: boolean) {
  return isTablet ? HiddenTabBar : PhoneTabBar;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 14,
    right: 14,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      android: {},
      default: {},
    }),
  },
  row: {
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 6,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    paddingVertical: 2,
  },
  iconWrap: {
    width: 36,
    height: 24,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
