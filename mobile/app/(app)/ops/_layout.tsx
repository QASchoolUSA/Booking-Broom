import { Stack } from "expo-router";
import { useTheme } from "@/theme";

export default function OpsStackLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.primary,
        headerTitleStyle: {
          fontFamily: "Poppins_600SemiBold",
          color: colors.foreground,
        },
        headerBackTitle: "Ops",
        gestureEnabled: true,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="sites" options={{ title: "Sites" }} />
      <Stack.Screen name="seo" options={{ title: "SEO" }} />
      <Stack.Screen name="speed" options={{ title: "Speed" }} />
      <Stack.Screen name="pricing" options={{ title: "Pricing" }} />
    </Stack>
  );
}
