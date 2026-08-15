import { Tabs } from "expo-router";
import { useConvexAuth, useQuery } from "convex/react";
import { useTheme } from "@/theme";
import { tabsBarRenderer } from "@/components/chrome/LiquidGlassTabBar";
import { api } from "@/lib/api";

export default function TabsLayout() {
  const { isTablet, colors } = useTheme();
  const { isAuthenticated } = useConvexAuth();
  const unread = useQuery(
    api.email.countUnread,
    isAuthenticated ? {} : "skip"
  );

  return (
    <Tabs
      tabBar={tabsBarRenderer(isTablet)}
      screenOptions={{
        headerShown: false,
        headerShadowVisible: false,
        lazy: true,
        freezeOnBlur: true,
        animation: "none",
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: {
          fontFamily: "Poppins_600SemiBold",
          fontSize: 17,
          color: colors.foreground,
        },
        headerTintColor: colors.primary,
        sceneStyle: {
          backgroundColor: colors.background,
          paddingBottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="bookings"
        options={{ title: "Bookings", tabBarLabel: "Bookings" }}
      />
      <Tabs.Screen
        name="messages"
        options={{ title: "Messages", tabBarLabel: "Messages" }}
      />
      <Tabs.Screen
        name="email"
        options={{
          title: "Email",
          tabBarLabel: "Email",
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
        options={{
          title: "Ops",
          tabBarLabel: "Ops",
          headerShown: true,
          freezeOnBlur: false,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarLabel: "Settings",
          headerShown: true,
          freezeOnBlur: false,
        }}
      />
    </Tabs>
  );
}
