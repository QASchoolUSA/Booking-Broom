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

type NotifyResult = {
  sent: number;
  removed: number;
  expoSent: number;
  skipped: string | null;
  expoErrors: string[];
};

type FanOutArgs = {
  title: string;
  body: string;
  url: string;
  mobilePath?: string;
  tag: string;
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

/** Fan-out web push + Expo push to all registered manager devices. */
async function fanOutPush(
  ctx: ActionCtx,
  args: FanOutArgs
): Promise<NotifyResult> {
  let sent = 0;
  let removed = 0;
  let expoSent = 0;
  let skipped: string | null = null;
  const expoErrors: string[] = [];

  const mobilePath = args.mobilePath ?? args.url;
  const vapid = configureVapid();
  if (vapid) {
    const payload = JSON.stringify({
      title: args.title,
      body: args.body,
      url: args.url,
      tag: args.tag,
    });
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

  const expoTokensRaw = (await ctx.runQuery(
    internal.push.listExpoTokensInternal,
    {}
  )) as ExpoTokenRow[];

  const seenTokens = new Set<string>();
  const expoTokens: ExpoTokenRow[] = [];
  for (const row of expoTokensRaw) {
    if (seenTokens.has(row.token)) continue;
    seenTokens.add(row.token);
    expoTokens.push(row);
  }

  if (expoTokens.length === 0) {
    console.info("Expo push: no registered tokens");
  } else {
    const messages = expoTokens.map((row) => ({
      to: row.token,
      title: args.title,
      body: args.body,
      sound: "default",
      channelId: "reminders",
      data: {
        url: args.url,
        mobilePath,
        tag: args.tag,
      },
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

type NotifyBookingArgs = {
  siteSlug: string;
  customerName: string;
  serviceType?: string;
  bookingId?: string;
};

async function notifyNewBookingHandler(
  ctx: ActionCtx,
  args: NotifyBookingArgs
): Promise<NotifyResult> {
  if (args.bookingId) {
    try {
      const claim = await ctx.runMutation(
        internal.bookings.claimPushNotifyInternal,
        { bookingId: args.bookingId as Id<"bookings"> }
      );
      if (!claim.claimed) {
        console.info(
          `Expo push: skip booking ${args.bookingId} (${claim.reason})`
        );
        return {
          sent: 0,
          removed: 0,
          expoSent: 0,
          skipped: `push_already_${claim.reason}`,
          expoErrors: [],
        };
      }
    } catch (e) {
      console.error(
        "Push claim failed:",
        e instanceof Error ? e.message : e
      );
    }
  }

  const site = await ctx.runQuery(internal.push.getSiteNameBySlugInternal, {
    slug: args.siteSlug,
  });
  const siteName = site?.name ?? args.siteSlug;
  const service = (args.serviceType ?? "Cleaning").trim() || "Cleaning";
  const customer = args.customerName.trim() || "Customer";
  const bookingId = args.bookingId;
  const url = bookingId
    ? `/calendar?bookingId=${bookingId}`
    : site?.slug
      ? `/sites/${site.slug}`
      : "/";
  const mobilePath = bookingId
    ? `/bookings/${bookingId}`
    : site?.slug
      ? `/bookings?site=${site.slug}`
      : "/bookings";
  const title = `New booking · ${siteName}`;
  const body = `${customer} — ${service}`;
  const tag = bookingId
    ? `booking-${bookingId}`
    : `booking-${args.siteSlug}-${Date.now()}`;

  return await fanOutPush(ctx, { title, body, url, mobilePath, tag });
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

const reminderNotifyArgs = {
  title: v.string(),
  body: v.string(),
  url: v.string(),
  mobilePath: v.optional(v.string()),
  tag: v.string(),
  bookingId: v.optional(v.id("bookings")),
  reminderId: v.optional(v.id("reminders")),
  siteSlug: v.optional(v.string()),
};

/** Push a manager reminder (scheduled or standalone). */
export const notifyReminderInternal = internalAction({
  args: reminderNotifyArgs,
  handler: async (ctx, args): Promise<NotifyResult> => {
    return await fanOutPush(ctx, {
      title: args.title,
      body: args.body,
      url: args.url,
      mobilePath: args.mobilePath,
      tag: args.tag,
    });
  },
});
