import { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { formatDistanceToNow } from "date-fns";
import { AppText, Button, Card, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import {
  initNotifications,
  isExpoGo,
  resolveEasProjectId,
} from "@/lib/notifications";
import { useTheme } from "@/theme";
import { radius, spacing } from "@/theme/tokens";

const WEB_URL =
  process.env.EXPO_PUBLIC_WEB_APP_URL ?? "https://bookings.kedrik.com";

export default function SettingsScreen() {
  const { colors, preference, setPreference, mode } = useTheme();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const sites = useQuery(api.sites.list, isAuthenticated ? {} : "skip");
  const gscConnection = useQuery(
    api.gsc.getConnection,
    isAuthenticated ? {} : "skip"
  );
  const bingSync = useQuery(
    api.bing.getSyncState,
    isAuthenticated ? {} : "skip"
  );
  const disconnectGsc = useMutation(api.gsc.disconnect);
  const saveToken = useMutation(api.push.saveExpoPushToken);
  const removeToken = useMutation(api.push.removeExpoPushToken);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [storedToken, setStoredToken] = useState<string | null>(null);

  const enablePush = useCallback(async () => {
    if (isExpoGo) {
      Alert.alert(
        "Development build required",
        "Expo Go cannot register for remote push on this SDK. Use an EAS development build for push."
      );
      return;
    }

    setPushBusy(true);
    try {
      await initNotifications();
      const Notifications = await import("expo-notifications");
      const Device = await import("expo-device");

      if (!Device.isDevice) {
        Alert.alert("Push unavailable", "Use a physical device.");
        return;
      }

      const { status: existing } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        Alert.alert("Permission denied", "Notifications were not allowed.");
        return;
      }

      const projectId = resolveEasProjectId();
      if (!projectId) {
        Alert.alert(
          "EAS project not linked",
          "Push needs a real EAS project UUID in app.json (extra.eas.projectId).\n\nFrom mobile/: run `npx eas-cli login` then `npx eas-cli init`, commit the generated projectId, rebuild the app, and try again."
        );
        return;
      }

      const token = (
        await Notifications.getExpoPushTokenAsync({ projectId })
      ).data;

      await saveToken({
        token,
        platform: Platform.OS === "ios" ? "ios" : "android",
      });
      setStoredToken(token);
      setPushEnabled(true);
    } catch (e) {
      Alert.alert(
        "Push error",
        e instanceof Error ? e.message : "Could not register for push"
      );
    } finally {
      setPushBusy(false);
    }
  }, [saveToken]);

  const disablePush = useCallback(async () => {
    setPushBusy(true);
    try {
      if (storedToken) {
        await removeToken({ token: storedToken });
      }
      setPushEnabled(false);
    } finally {
      setPushBusy(false);
    }
  }, [removeToken, storedToken]);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <AppText weight="semibold">Appearance</AppText>
          <AppText muted size={13} style={{ marginTop: 4, marginBottom: 12 }}>
            Current: {mode} ({preference})
          </AppText>
          <View style={styles.row}>
            {(["system", "light", "dark"] as const).map((pref) => {
              const active = preference === pref;
              return (
                <Pressable
                  key={pref}
                  onPress={() => setPreference(pref)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.primary : colors.muted,
                    },
                  ]}
                >
                  <AppText
                    size={13}
                    weight="semibold"
                    style={{
                      color: active
                        ? colors.primaryForeground
                        : colors.foreground,
                      textTransform: "capitalize",
                    }}
                  >
                    {pref}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card>
          <AppText weight="semibold">Push notifications</AppText>
          <AppText muted size={13} style={{ marginTop: 4, marginBottom: 12 }}>
            {isExpoGo
              ? "Remote push needs an EAS development build (not Expo Go)."
              : "Get alerted on this device when a new booking arrives."}
          </AppText>
          <Button
            label={
              pushBusy
                ? "Working…"
                : pushEnabled
                  ? "Disable Expo push"
                  : "Enable Expo push"
            }
            variant={pushEnabled ? "secondary" : "accent"}
            loading={pushBusy}
            onPress={pushEnabled ? disablePush : enablePush}
          />
        </Card>

        <Card>
          <AppText weight="semibold">Sites</AppText>
          <AppText muted size={13} style={{ marginTop: 8 }}>
            {(sites ?? []).map((s: { name: string }) => s.name).join(" · ") ||
              "Loading…"}
          </AppText>
        </Card>

        <Card>
          <AppText weight="semibold">Search Console</AppText>
          <AppText muted size={13} style={{ marginTop: 4, marginBottom: 12 }}>
            {gscConnection
              ? `Connected · ${gscConnection.google_email}`
              : "Not connected — finish Google OAuth in the web app."}
          </AppText>
          <View style={{ gap: 8 }}>
            <Button
              label="Open web to connect"
              variant="secondary"
              onPress={() => Linking.openURL(`${WEB_URL}/seo`)}
            />
            {gscConnection ? (
              <Button
                label="Disconnect Google"
                variant="ghost"
                onPress={() => {
                  Alert.alert(
                    "Disconnect Search Console?",
                    "You can reconnect from the web app anytime.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Disconnect",
                        style: "destructive",
                        onPress: () => void disconnectGsc({}),
                      },
                    ]
                  );
                }}
              />
            ) : null}
          </View>
        </Card>

        <Card>
          <AppText weight="semibold">Bing Webmaster</AppText>
          <AppText muted size={13} style={{ marginTop: 8 }}>
            {bingSync
              ? bingSync.last_sync_at
                ? `Last sync ${formatDistanceToNow(new Date(bingSync.last_sync_at), { addSuffix: true })}`
                : bingSync.last_sync_error
                  ? `Last error: ${bingSync.last_sync_error}`
                  : "API key is configured on the server. Sync from the SEO page."
              : "No Bing sync yet. The API key lives in Convex env."}
          </AppText>
        </Card>

        <Button
          label="Sign out"
          variant="destructive"
          onPress={async () => {
            await signOut();
            router.replace("/login");
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
});
