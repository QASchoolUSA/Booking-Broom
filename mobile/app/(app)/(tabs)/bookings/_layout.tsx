import { Stack } from "expo-router";
import { useTheme } from "@/theme";
import { useNestedStackTabBarListeners } from "@/components/chrome/ChromeContext";

export default function BookingsLayout() {
  const { colors } = useTheme();
  const screenListeners = useNestedStackTabBarListeners();
  return (
    <Stack
      screenListeners={screenListeners}
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: {
          fontFamily: "Poppins_600SemiBold",
          fontSize: 17,
          color: colors.foreground,
        },
        headerTintColor: colors.primary,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Bookings" }} />
      <Stack.Screen name="[id]" options={{ title: "Booking" }} />
    </Stack>
  );
}
