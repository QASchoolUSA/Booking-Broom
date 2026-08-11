"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import webpush from "web-push";

type SubRow = {
  _id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
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

/**
 * Best-effort Web Push to all manager devices when a booking is created.
 * Safe to call without auth (from the public bookings API).
 */
export const notifyNewBooking = action({
  args: {
    siteSlug: v.string(),
    customerName: v.string(),
    serviceType: v.optional(v.string()),
    bookingId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ sent: number; removed: number; skipped: string | null }> => {
    if (!configureVapid()) {
      return {
        sent: 0,
        removed: 0,
        skipped: "VAPID keys not configured",
      };
    }

    const site = await ctx.runQuery(internal.push.getSiteNameBySlugInternal, {
      slug: args.siteSlug,
    });
    const siteName = site?.name ?? args.siteSlug;
    const service = (args.serviceType ?? "Cleaning").trim() || "Cleaning";
    const customer = args.customerName.trim() || "Customer";
    const url = site?.slug ? `/sites/${site.slug}` : "/";

    const payload = JSON.stringify({
      title: `New booking · ${siteName}`,
      body: `${customer} — ${service}`,
      url,
      tag: args.bookingId
        ? `booking-${args.bookingId}`
        : `booking-${args.siteSlug}-${Date.now()}`,
    });

    const subs = (await ctx.runQuery(
      internal.push.listAllInternal,
      {}
    )) as SubRow[];

    let sent = 0;
    let removed = 0;

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

    return { sent, removed, skipped: null };
  },
});
