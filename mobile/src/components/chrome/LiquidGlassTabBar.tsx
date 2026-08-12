import React, { memo, useMemo } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CalendarDays,
  MessageSquare,
  Mail,
  LayoutGrid,
  Settings,
} from "lucide-react-native";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "@/components/ui";

const ICONS = {
  bookings: CalendarDays,
  messages: MessageSquare,
  email: Mail,
  ops: LayoutGrid,
  settings: Settings,
} as const;

/** Compatible with Expo Router's custom tabBar render props. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TabBarRenderProps = any;

function LiquidGlassTabBarComponent({
  state,
  descriptors,
  navigation,
}: TabBarRenderProps) {
  const insets = useSafeAreaInsets();
  const { colors, mode, reduceTransparency } = useTheme();
  const useBlur = !reduceTransparency && Platform.OS === "ios";

  const containerStyle = useMemo(
    () => [
      styles.wrap,
      {
        paddingBottom: Math.max(insets.bottom, spacing.sm),
        borderColor: colors.tabBarBorder,
        backgroundColor: useBlur ? "transparent" : colors.tabBarGlass,
      },
    ],
    [insets.bottom, colors.tabBarBorder, colors.tabBarGlass, useBlur]
  );

  return (
    <View style={containerStyle} pointerEvents="box-none">
      {useBlur ? (
        <BlurView
          intensity={mode === "dark" ? 42 : 55}
          tint={mode === "dark" ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.tabBarGlass },
        ]}
        pointerEvents="none"
      />
      <View style={styles.row}>
        {state.routes.map((route: { key: string; name: string; params?: object }, index: number) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : options.title ?? route.name;
          const iconKey = route.name as keyof typeof ICONS;
          const Icon = ICONS[iconKey] ?? LayoutGrid;
          const color = focused ? colors.primary : colors.mutedForeground;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
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
              hitSlop={6}
            >
              <View
                style={[
                  styles.iconWrap,
                  focused && {
                    backgroundColor:
                      mode === "dark"
                        ? "rgba(96, 165, 250, 0.16)"
                        : "rgba(30, 64, 175, 0.1)",
                  },
                ]}
              >
                <Icon size={22} color={color} strokeWidth={focused ? 2.4 : 2} />
              </View>
              <AppText
                size={11}
                weight={focused ? "semibold" : "medium"}
                style={{ color, marginTop: 2 }}
                numberOfLines={1}
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const LiquidGlassTabBar = memo(LiquidGlassTabBarComponent);

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    paddingVertical: spacing.xs,
  },
  iconWrap: {
    width: 40,
    height: 28,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
