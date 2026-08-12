import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CalendarDays,
  MessageSquare,
  Mail,
  Globe,
  ChartLine,
  Gauge,
  DollarSign,
  Settings,
  Sparkles,
} from "lucide-react-native";
import { useConvexAuth, useQuery } from "convex/react";
import { useTheme } from "@/theme";
import { SIDEBAR_WIDTH, spacing, radius } from "@/theme/tokens";
import { AppText } from "@/components/ui";
import { api } from "@/lib/api";

type NavItem = {
  href: string;
  label: string;
  icon: typeof CalendarDays;
  match: (path: string) => boolean;
};

const NAV: NavItem[] = [
  {
    href: "/bookings",
    label: "Bookings",
    icon: CalendarDays,
    match: (p) => p.includes("bookings") || p === "/",
  },
  {
    href: "/messages",
    label: "Messages",
    icon: MessageSquare,
    match: (p) => p.includes("messages"),
  },
  {
    href: "/email",
    label: "Email",
    icon: Mail,
    match: (p) => p.includes("email"),
  },
  {
    href: "/ops/sites",
    label: "Sites",
    icon: Globe,
    match: (p) => p.includes("/ops/sites") || p.endsWith("/ops"),
  },
  {
    href: "/ops/seo",
    label: "SEO",
    icon: ChartLine,
    match: (p) => p.includes("seo"),
  },
  {
    href: "/ops/speed",
    label: "Speed",
    icon: Gauge,
    match: (p) => p.includes("speed"),
  },
  {
    href: "/ops/pricing",
    label: "Pricing",
    icon: DollarSign,
    match: (p) => p.includes("pricing"),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    match: (p) => p.includes("settings"),
  },
];

export function TabletSidebar() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const unread = useQuery(
    api.email.countUnread,
    isAuthenticated ? {} : "skip"
  );

  return (
    <View
      style={[
        styles.sidebar,
        {
          width: SIDEBAR_WIDTH,
          backgroundColor: colors.surface,
          borderRightColor: colors.border,
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.md,
        },
      ]}
    >
      <View style={styles.brand}>
        <View style={[styles.brandIcon, { backgroundColor: colors.primary }]}>
          <Sparkles size={18} color={colors.primaryForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText weight="bold" size={15}>
            Booking Broom
          </AppText>
          <AppText muted size={12}>
            Manager
          </AppText>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.nav} showsVerticalScrollIndicator={false}>
        {NAV.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          const showBadge = item.label === "Email" && typeof unread === "number" && unread > 0;
          return (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href as never)}
              style={[
                styles.navItem,
                active && {
                  backgroundColor: colors.muted,
                },
              ]}
            >
              {active ? (
                <View style={[styles.activeBar, { backgroundColor: colors.primary }]} />
              ) : null}
              <Icon
                size={18}
                color={active ? colors.primary : colors.mutedForeground}
                strokeWidth={active ? 2.4 : 2}
              />
              <AppText
                style={{ flex: 1 }}
                weight={active ? "semibold" : "medium"}
                size={14}
              >
                {item.label}
              </AppText>
              {showBadge ? (
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <AppText size={10} style={{ color: colors.primaryForeground }} weight="bold">
                    {unread > 99 ? "99+" : unread}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  nav: { gap: 4 },
  navItem: {
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    position: "relative",
    overflow: "hidden",
  },
  activeBar: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
});
