import { Pressable } from "react-native";
import { Stack, useRouter } from "expo-router";
import { AppText } from "@/components/ui";
import { useTheme } from "@/theme";

function CloseButton() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => {
        if (router.canDismiss()) {
          router.dismiss();
        } else {
          router.back();
        }
      }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Close"
    >
      <AppText weight="semibold" style={{ color: colors.primary }}>
        Close
      </AppText>
    </Pressable>
  );
}

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
        headerTitleAlign: "center",
        headerLeft: () => <CloseButton />,
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
