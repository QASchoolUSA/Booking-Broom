import { Platform } from "react-native";
import Constants from "expo-constants";

const isExpoGo = Constants.appOwnership === "expo";

let initialized = false;

/**
 * Register the foreground notification handler once per app process.
 * Safe to call multiple times; no-ops in Expo Go.
 */
export async function initNotifications() {
  if (initialized || isExpoGo) return;
  initialized = true;

  try {
    const Notifications = await import("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#1E40AF",
      });
    }
  } catch (e) {
    console.warn(
      "Failed to init notifications:",
      e instanceof Error ? e.message : e
    );
    initialized = false;
  }
}

export function resolveEasProjectId(): string | null {
  const raw =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    null;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuid.test(raw.trim()) ? raw.trim() : null;
}

export { isExpoGo };
