"use client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export type PushSupport =
  | "supported"
  | "unsupported"
  | "ios-needs-install"
  | "insecure";

export function detectPushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (!window.isSecureContext) return "insecure";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    const ua = navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIOS) return "ios-needs-install";
    return "unsupported";
  }
  return "supported";
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)");
  if (mq.matches) return true;
  // iOS Safari legacy
  return (
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (detectPushSupport() !== "supported") return null;
  const reg = await navigator.serviceWorker.ready;
  return (await reg.pushManager.getSubscription()) ?? null;
}

export async function subscribeToPush(
  vapidPublicKey: string
): Promise<PushSubscription> {
  if (detectPushSupport() !== "supported") {
    throw new Error("Push notifications are not supported in this browser");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted");
  }

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  return await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(
      vapidPublicKey
    ) as BufferSource,
  });
}

export async function unsubscribeFromPush(): Promise<boolean> {
  const sub = await getExistingPushSubscription();
  if (!sub) return false;
  return await sub.unsubscribe();
}

export function subscriptionKeys(sub: PushSubscription): {
  endpoint: string;
  p256dh: string;
  auth: string;
} {
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    throw new Error("Push subscription is missing keys");
  }
  return { endpoint: json.endpoint, p256dh, auth };
}
