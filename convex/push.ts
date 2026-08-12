import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";

async function requireUserId(ctx: {
  auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
}) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  return identity.subject;
}

export const getVapidPublicKey = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const key = process.env.VAPID_PUBLIC_KEY?.trim();
    return key || null;
  },
});

export const hasSubscriptionForEndpoint = query({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    return Boolean(existing && existing.userId === identity.subject);
  },
});

export const saveSubscription = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const endpoint = args.endpoint.trim();
    const p256dh = args.p256dh.trim();
    const auth = args.auth.trim();
    if (!endpoint || !p256dh || !auth) {
      throw new Error("Invalid push subscription");
    }

    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        userId,
        p256dh,
        auth,
        userAgent: args.userAgent,
        createdAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("pushSubscriptions", {
      userId,
      endpoint,
      p256dh,
      auth,
      userAgent: args.userAgent,
      createdAt: now,
    });
  },
});

export const removeSubscription = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint.trim()))
      .unique();
    if (!existing) return false;
    if (existing.userId !== userId) throw new Error("Unauthorized");
    await ctx.db.delete(existing._id);
    return true;
  },
});

export const listAllInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("pushSubscriptions").collect();
  },
});

export const removeByIdInternal = internalMutation({
  args: { id: v.id("pushSubscriptions") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) return false;
    await ctx.db.delete(args.id);
    return true;
  },
});

export const removeByEndpointInternal = internalMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    if (!existing) return false;
    await ctx.db.delete(existing._id);
    return true;
  },
});

/** Resolve site display name for push payload (internal). */
export const getSiteNameBySlugInternal = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    return site ? { name: site.name, slug: site.slug } : null;
  },
});

export const saveExpoPushToken = mutation({
  args: {
    token: v.string(),
    platform: v.union(v.literal("ios"), v.literal("android")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const token = args.token.trim();
    if (!token) throw new Error("Invalid Expo push token");

    const now = Date.now();

    // Keep a single token per user so one booking never fans out twice.
    const forUser = await ctx.db
      .query("expoPushTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of forUser) {
      if (row.token !== token) {
        await ctx.db.delete(row._id);
      }
    }

    const existing = await ctx.db
      .query("expoPushTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        userId,
        platform: args.platform,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("expoPushTokens", {
      userId,
      token,
      platform: args.platform,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const removeExpoPushToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("expoPushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token.trim()))
      .unique();
    if (!existing) return false;
    if (existing.userId !== userId) throw new Error("Unauthorized");
    await ctx.db.delete(existing._id);
    return true;
  },
});

export const listExpoTokensInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("expoPushTokens").collect();
  },
});

export const removeExpoTokenByIdInternal = internalMutation({
  args: { id: v.id("expoPushTokens") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) return false;
    await ctx.db.delete(args.id);
    return true;
  },
});
