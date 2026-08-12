import { Tabs } from "expo-router";
import { useConvexAuth, useQuery } from "convex/react";
import { useTheme } from "@/theme";
import { useChrome } from "@/components/chrome/ChromeContext";
import { LiquidGlassTabBar } from "@/components/chrome/LiquidGlassTabBar";
import { api } from "@/lib/api";

export default function TabsLayout() {
  const { isTablet, colors } = useTheme();
  const { hideTabBar } = useChrome();
  const { isAuthenticated } = useConvexAuth();
  const unread = useQuery(
    api.email.countUnread,
    isAuthenticated ? {} : "skip"
  );

  return (
    <Tabs
      tabBar={(props) => {
        if (isTablet || hideTabBar) return null;
        return <LiquidGlassTabBar {...props} />;
      }}
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        freezeOnBlur: true,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: {
          fontFamily: "Poppins_600SemiBold",
          fontSize: 17,
          color: colors.foreground,
        },
        headerTintColor: colors.primary,
        sceneStyle: {
          backgroundColor: colors.background,
          paddingBottom: isTablet || hideTabBar ? 0 : 88,
        },
      }}
    >
      <Tabs.Screen
        name="bookings"
        options={{ title: "Bookings", tabBarLabel: "Bookings" }}
      />
      <Tabs.Screen
        name="messages"
        options={{ title: "Messages", tabBarLabel: "Messages", headerShown: false }}
      />
      <Tabs.Screen
        name="email"
        options={{
          title: "Email",
          tabBarLabel: "Email",
          headerShown: false,
          tabBarBadge:
            typeof unread === "number" && unread > 0
              ? unread > 99
                ? "99+"
                : unread
              : undefined,
        }}
      />
      <Tabs.Screen
        name="ops"
        options={{ title: "Ops", tabBarLabel: "Ops" }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarLabel: "Settings" }}
      />
    </Tabs>
  );
}
