import "../src/polyfills";
import { useEffect } from "react";
import { ActivityIndicator, Modal, StyleSheet, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import {
  OpenSans_400Regular,
  OpenSans_600SemiBold,
} from "@expo-google-fonts/open-sans";
import { useConvexAuth } from "convex/react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConvexClientProvider } from "@/lib/convex";
import { initNotifications } from "@/lib/notifications";
import { ThemeProvider, useTheme } from "@/theme";
import { ChromeProvider } from "@/components/chrome/ChromeContext";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === "(auth)";
    if (!isAuthenticated && !inAuth) {
      router.replace("/login");
    } else if (isAuthenticated && inAuth) {
      router.replace("/bookings");
    }
  }, [isAuthenticated, isLoading, segments, router]);

  // Keep the root Stack mounted while auth resolves. Unmounting it (returning
  // only a spinner) causes "Unmatched Route" / silent kills on physical Expo Go
  // where auth + network are slower than the simulator.
  // Fragment only — never wrap the root navigator in a View.
  return (
    <>
      {children}
      <Modal visible={isLoading} transparent animationType="fade">
        <View style={styles.authOverlay}>
          <ActivityIndicator size="large" color="#1E40AF" />
        </View>
      </Modal>
    </>
  );
}

function RootNavigator() {
  const { mode, colors } = useTheme();
  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <AuthGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </AuthGate>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_700Bold,
    OpenSans_400Regular,
    OpenSans_600SemiBold,
  });

  useEffect(() => {
    void initNotifications();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <ConvexClientProvider>
            <ThemeProvider>
              <ChromeProvider>
                <RootNavigator />
              </ChromeProvider>
            </ThemeProvider>
          </ConvexClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  authOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
  },
});
