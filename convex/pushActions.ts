"use node";

import { action, internalAction, type ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import webpush from "web-push";
import { readApnsConfig, sendApnsAlert } from "./lib/apns";

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

type ApnsTokenRow = {
  _id: Id<"apnsPushTokens">;
  token: string;
  environment: "development" | "production";
};

type NotifyResult = {
  sent: number;
  removed: number;
  expoSent: number;
  apnsSent: number;
  skipped: string | null;
  expoErrors: string[];
  apnsErrors: string[];
};

type FanOutArgs = {
  title: string;
  body: string;
  url: string;
  mobilePath?: string;
  tag: string;
  bookingId?: string;
  leadId?: string;
  kind: "quote" | "book" | "abandoned";
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

/** Fan-out web push + Expo push + APNs to all registered manager devices. */
async function fanOutPush(
  ctx: ActionCtx,
  args: FanOutArgs
): Promise<NotifyResult> {
  let sent = 0;
  let removed = 0;
  let expoSent = 0;
  let apnsSent = 0;
  let skipped: string | null = null;
  const expoErrors: string[] = [];
  const apnsErrors: string[] = [];

  const mobilePath = args.mobilePath ?? args.url;
  const vapid = configureVapid();
  if (vapid) {
    const payload = JSON.stringify({
      title: args.title,
      body: args.body,
      url: args.url,
      tag: args.tag,
      kind: args.kind,
      bookingId: args.bookingId,
      leadId: args.leadId,
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
        kind: args.kind,
        bookingId: args.bookingId,
        leadId: args.leadId,
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

  const apnsConfig = readApnsConfig();
  if (!apnsConfig) {
    console.info(
      "APNs push: skipped (set APNS_KEY_ID, APNS_TEAM_ID, APNS_AUTH_KEY)"
    );
  } else {
    const apnsTokensRaw = (await ctx.runQuery(
      internal.push.listApnsTokensInternal,
      {}
    )) as ApnsTokenRow[];

    const seenApns = new Set<string>();
    const apnsTokens: ApnsTokenRow[] = [];
    for (const row of apnsTokensRaw) {
      if (seenApns.has(row.token)) continue;
      seenApns.add(row.token);
      apnsTokens.push(row);
    }

    if (apnsTokens.length === 0) {
      console.info("APNs push: no registered tokens");
    } else {
      for (const row of apnsTokens) {
        const result = await sendApnsAlert({
          config: apnsConfig,
          deviceToken: row.token,
          environment: row.environment,
          title: args.title,
          body: args.body,
          tag: args.tag,
          url: args.url,
          mobilePath,
          bookingId: args.bookingId,
          leadId: args.leadId,
          kind: args.kind,
        });
        if (result.ok) {
          apnsSent += 1;
          continue;
        }
        apnsErrors.push(result.reason);
        console.error("APNs push failed:", result.reason, result.status);
        if (result.stale) {
          await ctx.runMutation(internal.push.removeApnsTokenByIdInternal, {
            id: row._id,
          });
          removed += 1;
        }
      }
      console.info(
        `APNs push: sent=${apnsSent} tokens=${apnsTokens.length} errors=${apnsErrors.length}`
      );
    }
  }

  return {
    sent,
    removed,
    expoSent,
    apnsSent,
    skipped,
    expoErrors,
    apnsErrors,
  };
}

type NotifyBookingArgs = {
  siteSlug: string;
  customerName: string;
  serviceType?: string;
  bookingId?: string;
  leadId?: string;
  intent?: "quote" | "book";
  kind?: "quote" | "book" | "abandoned";
};

function resolveNotifyKind(
  args: NotifyBookingArgs
): "quote" | "book" | "abandoned" {
  if (args.kind === "abandoned" || args.kind === "quote" || args.kind === "book") {
    return args.kind;
  }
  return args.intent === "quote" ? "quote" : "book";
}

function kindTitleLabel(kind: "quote" | "book" | "abandoned"): string {
  switch (kind) {
    case "quote":
      return "Quote";
    case "abandoned":
      return "Abandoned";
    default:
      return "Booking";
  }
}

async function notifyNewBookingHandler(
  ctx: ActionCtx,
  args: NotifyBookingArgs
): Promise<NotifyResult> {
  const kind = resolveNotifyKind(args);

  if (args.bookingId) {
    try {
      const claim = await ctx.runMutation(
        internal.bookings.claimPushNotifyInternal,
        { bookingId: args.bookingId as Id<"bookings"> }
      );
      if (!claim.claimed) {
        console.info(
          `Push: skip booking ${args.bookingId} (${claim.reason})`
        );
        return {
          sent: 0,
          removed: 0,
          expoSent: 0,
          apnsSent: 0,
          skipped: `push_already_${claim.reason}`,
          expoErrors: [],
          apnsErrors: [],
        };
      }
    } catch (e) {
      console.error(
        "Push claim failed:",
        e instanceof Error ? e.message : e
      );
    }
  }

  if (args.leadId) {
    try {
      const claim = await ctx.runMutation(
        internal.partialLeads.claimPushNotifyInternal,
        { leadId: args.leadId as Id<"partialLeads"> }
      );
      if (!claim.claimed) {
        console.info(`Push: skip lead ${args.leadId} (${claim.reason})`);
        return {
          sent: 0,
          removed: 0,
          expoSent: 0,
          apnsSent: 0,
          skipped: `push_already_${claim.reason}`,
          expoErrors: [],
          apnsErrors: [],
        };
      }
    } catch (e) {
      console.error(
        "Push lead claim failed:",
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
  const leadId = args.leadId;

  const url =
    kind === "abandoned"
      ? leadId
        ? `/?view=abandoned&leadId=${leadId}`
        : "/?view=abandoned"
      : bookingId
        ? `/calendar?bookingId=${bookingId}`
        : site?.slug
          ? `/sites/${site.slug}`
          : "/";
  const mobilePath =
    kind === "abandoned"
      ? leadId
        ? `/leads/${leadId}`
        : "/leads"
      : bookingId
        ? `/bookings/${bookingId}`
        : site?.slug
          ? `/bookings?site=${site.slug}`
          : "/bookings";

  const title = `${kindTitleLabel(kind)} · ${siteName}`;
  const body =
    kind === "abandoned"
      ? `${customer} left before finishing — ${service}`
      : kind === "quote"
        ? `${customer} requested a quote — ${service}`
        : `${customer} booked — ${service}`;
  const tag = bookingId
    ? `booking-${bookingId}`
    : leadId
      ? `lead-${leadId}`
      : `${kind}-${args.siteSlug}-${Date.now()}`;

  return await fanOutPush(ctx, {
    title,
    body,
    url,
    mobilePath,
    tag,
    bookingId,
    leadId,
    kind,
  });
}

const notifyArgs = {
  siteSlug: v.string(),
  customerName: v.string(),
  serviceType: v.optional(v.string()),
  bookingId: v.optional(v.string()),
  leadId: v.optional(v.string()),
  intent: v.optional(v.union(v.literal("quote"), v.literal("book"))),
  kind: v.optional(
    v.union(v.literal("quote"), v.literal("book"), v.literal("abandoned"))
  ),
};

/**
 * Best-effort push for new bookings, quotes, and abandoned leads.
 * Sends Web Push (PWA), Expo Push, and native APNs. Safe without auth.
 */
export const notifyNewBooking = action({
  args: notifyArgs,
  handler: async (ctx, args): Promise<NotifyResult> => {
    return await notifyNewBookingHandler(ctx, args);
  },
});

/** Scheduled from bookings.createPublic / partialLeads.upsertPublic. */
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
      bookingId: args.bookingId,
      kind: "book",
    });
  },
});
