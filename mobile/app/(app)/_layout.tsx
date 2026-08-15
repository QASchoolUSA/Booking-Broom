import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme";
import { TabletSidebar } from "@/components/chrome/TabletSidebar";

export default function AppLayout() {
  const { isTablet, colors } = useTheme();

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="ops"
        options={{
          headerShown: false,
          gestureEnabled: true,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </Stack>
  );

  if (isTablet) {
    return (
      <View style={[styles.row, { backgroundColor: colors.background }]}>
        <TabletSidebar />
        <View style={styles.content}>{stack}</View>
      </View>
    );
  }

  return stack;
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: "row" },
  content: { flex: 1 },
});
