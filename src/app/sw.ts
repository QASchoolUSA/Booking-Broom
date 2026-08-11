/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

type PushPayload = {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
};

self.addEventListener("push", (event: PushEvent) => {
  let data: PushPayload = {};
  try {
    if (event.data) {
      data = event.data.json() as PushPayload;
    }
  } catch {
    data = { body: event.data?.text() };
  }

  const title = data.title?.trim() || "Booking Broom";
  const options: NotificationOptions = {
    body: data.body?.trim() || "New booking received",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "booking-broom",
    data: { url: data.url || "/" },
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data &&
      typeof event.notification.data === "object" &&
      "url" in event.notification.data &&
      typeof (event.notification.data as { url: unknown }).url === "string"
      ? (event.notification.data as { url: string }).url
      : "/") || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await (client as WindowClient).navigate(targetUrl);
            } catch {
              // ignore navigate failures; focus is enough
            }
          }
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});
