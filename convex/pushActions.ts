"use node";

import { action, internalAction, type ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import webpush from "web-push";

type SubRow = {
  _id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type ExpoTokenRow = {
  _id: Id<"expoPushTokens">;
  token: string;
};

type NotifyArgs = {
  siteSlug: string;
  customerName: string;
  serviceType?: string;
  bookingId?: string;
};

type NotifyResult = {
  sent: number;
  removed: number;
  expoSent: number;
  skipped: string | null;
  expoErrors: string[];
};

function configureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:ops@bookingbroom.local";
  if (!publicKey || !privateKey) {
    return null;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return { publicKey, privateKey, subject };
}

async function sendExpoPush(
  messages: Array<Record<string, unknown>>,
  tokenIds: Id<"expoPushTokens">[]
) {
  if (messages.length === 0) {
    return {
      sent: 0,
      staleIds: [] as Id<"expoPushTokens">[],
      errors: [] as string[],
    };
  }
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Expo push HTTP error:", res.status, text);
    return {
      sent: 0,
      staleIds: [] as Id<"expoPushTokens">[],
      errors: [`HTTP ${res.status}: ${text.slice(0, 200)}`],
    };
  }
  const json = (await res.json()) as {
    data?: Array<{
      status?: string;
      message?: string;
      details?: { error?: string };
    }>;
  };
  const data = json.data ?? [];
  let sent = 0;
  const staleIds: Id<"expoPushTokens">[] = [];
  const errors: string[] = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row?.status === "ok") {
      sent += 1;
      continue;
    }
    const err = row?.details?.error ?? row?.message ?? row?.status ?? "unknown";
    errors.push(String(err));
    console.error("Expo push ticket error:", err, row);
    if (err === "DeviceNotRegistered" && tokenIds[i]) {
      staleIds.push(tokenIds[i]);
    }
  }
  return { sent, staleIds, errors };
}

async function notifyNewBookingHandler(
  ctx: ActionCtx,
  args: NotifyArgs
): Promise<NotifyResult> {
  const site = await ctx.runQuery(internal.push.getSiteNameBySlugInternal, {
    slug: args.siteSlug,
  });
  const siteName = site?.name ?? args.siteSlug;
  const service = (args.serviceType ?? "Cleaning").trim() || "Cleaning";
  const customer = args.customerName.trim() || "Customer";
  const url = site?.slug ? `/sites/${site.slug}` : "/";
  const title = `New booking · ${siteName}`;
  const body = `${customer} — ${service}`;
  const tag = args.bookingId
    ? `booking-${args.bookingId}`
    : `booking-${args.siteSlug}-${Date.now()}`;

  let sent = 0;
  let removed = 0;
  let expoSent = 0;
  let skipped: string | null = null;
  const expoErrors: string[] = [];

  const vapid = configureVapid();
  if (vapid) {
    const payload = JSON.stringify({ title, body, url, tag });
    const subs = (await ctx.runQuery(
      internal.push.listAllInternal,
      {}
    )) as SubRow[];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 60 * 60 }
        );
        sent += 1;
      } catch (e) {
        const statusCode =
          e && typeof e === "object" && "statusCode" in e
            ? Number((e as { statusCode: number }).statusCode)
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await ctx.runMutation(internal.push.removeByEndpointInternal, {
            endpoint: sub.endpoint,
          });
          removed += 1;
        } else {
          console.error(
            "Web push failed:",
            e instanceof Error ? e.message : e
          );
        }
      }
    }
  } else {
    skipped = "VAPID keys not configured";
  }

  const expoTokens = (await ctx.runQuery(
    internal.push.listExpoTokensInternal,
    {}
  )) as ExpoTokenRow[];

  if (expoTokens.length === 0) {
    console.info("Expo push: no registered tokens");
  } else {
    const messages = expoTokens.map((row) => ({
      to: row.token,
      title,
      body,
      sound: "default",
      data: { url, tag },
    }));
    const expoResult = await sendExpoPush(
      messages,
      expoTokens.map((r) => r._id)
    );
    expoSent = expoResult.sent;
    expoErrors.push(...expoResult.errors);
    for (const id of expoResult.staleIds) {
      await ctx.runMutation(internal.push.removeExpoTokenByIdInternal, {
        id,
      });
      removed += 1;
    }
    console.info(
      `Expo push: sent=${expoSent} tokens=${expoTokens.length} errors=${expoResult.errors.length}`
    );
  }

  return { sent, removed, expoSent, skipped, expoErrors };
}

const notifyArgs = {
  siteSlug: v.string(),
  customerName: v.string(),
  serviceType: v.optional(v.string()),
  bookingId: v.optional(v.string()),
};

/**
 * Best-effort push to manager devices when a booking is created.
 * Sends Web Push (PWA) and Expo Push (native app). Safe without auth.
 */
export const notifyNewBooking = action({
  args: notifyArgs,
  handler: async (ctx, args): Promise<NotifyResult> => {
    return await notifyNewBookingHandler(ctx, args);
  },
});

/** Scheduled from bookings.createPublic so push is not dependent on the Next.js API route. */
export const notifyNewBookingInternal = internalAction({
  args: notifyArgs,
  handler: async (ctx, args): Promise<NotifyResult> => {
    return await notifyNewBookingHandler(ctx, args);
  },
});
