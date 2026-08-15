import { Stack } from "expo-router";
import { useTheme } from "@/theme";
import { useNestedStackTabBarListeners } from "@/components/chrome/ChromeContext";

export default function EmailLayout() {
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
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[threadId]" options={{ title: "Email" }} />
    </Stack>
  );
}
