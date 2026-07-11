import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const periodDays = v.union(v.literal(7), v.literal(28), v.literal(90));

function mapConnection(doc: {
  _id: Id<"gscConnections">;
  googleEmail: string;
  connectedAt: number;
  lastSyncAt?: number;
  lastSyncError?: string;
}) {
  return {
    id: doc._id,
    google_email: doc.googleEmail,
    connected_at: new Date(doc.connectedAt).toISOString(),
    last_sync_at: doc.lastSyncAt
      ? new Date(doc.lastSyncAt).toISOString()
      : null,
    last_sync_error: doc.lastSyncError ?? null,
  };
}

function mapMetric(doc: {
  _id: Id<"siteSearchMetrics">;
  siteId: Id<"sites">;
  periodDays: 7 | 28 | 90;
  gscPropertyUrl: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  startDate: string;
  endDate: string;
  syncedAt: number;
}) {
  return {
    id: doc._id,
    site_id: doc.siteId,
    period_days: doc.periodDays,
    gsc_property_url: doc.gscPropertyUrl,
    clicks: doc.clicks,
    impressions: doc.impressions,
    ctr: doc.ctr,
    position: doc.position,
    start_date: doc.startDate,
    end_date: doc.endDate,
    synced_at: new Date(doc.syncedAt).toISOString(),
  };
}

export const getConnection = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const connection = await ctx.db.query("gscConnections").first();
    if (!connection) return null;
    return mapConnection(connection);
  },
});

export const listMetrics = query({
  args: { periodDays },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const sites = await ctx.db.query("sites").collect();
    const results = [];

    for (const site of sites.sort((a, b) => a.name.localeCompare(b.name))) {
      const metric = await ctx.db
        .query("siteSearchMetrics")
        .withIndex("by_site_period", (q) =>
          q.eq("siteId", site._id).eq("periodDays", args.periodDays)
        )
        .unique();

      results.push({
        site: {
          id: site._id,
          slug: site.slug,
          name: site.name,
          domain: site.domain,
          accent_color: site.accentColor,
          gsc_property_url: site.gscPropertyUrl ?? null,
        },
        metrics: metric ? mapMetric(metric) : null,
      });
    }

    return results;
  },
});

export const updateGscProperty = mutation({
  args: {
    siteId: v.id("sites"),
    gscPropertyUrl: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const site = await ctx.db.get(args.siteId);
    if (!site) throw new Error("Site not found");

    const value = args.gscPropertyUrl?.trim() || undefined;
    await ctx.db.patch(args.siteId, { gscPropertyUrl: value });
  },
});

export const disconnect = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const connections = await ctx.db.query("gscConnections").collect();
    for (const c of connections) {
      await ctx.db.delete(c._id);
    }

    const metrics = await ctx.db.query("siteSearchMetrics").collect();
    for (const m of metrics) {
      await ctx.db.delete(m._id);
    }
  },
});

export const createOauthState = internalMutation({
  args: {
    state: v.string(),
    returnOrigin: v.string(),
  },
  handler: async (ctx, args) => {
    // Clean up stale states older than 1 hour
    const cutoff = Date.now() - 60 * 60 * 1000;
    const stale = await ctx.db.query("gscOauthStates").collect();
    for (const row of stale) {
      if (row.createdAt < cutoff) await ctx.db.delete(row._id);
    }

    await ctx.db.insert("gscOauthStates", {
      state: args.state,
      returnOrigin: args.returnOrigin,
      createdAt: Date.now(),
    });
  },
});

export const consumeOauthState = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("gscOauthStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .unique();
    if (!row) return null;
    if (Date.now() - row.createdAt > 60 * 60 * 1000) {
      await ctx.db.delete(row._id);
      return null;
    }
    const returnOrigin = row.returnOrigin;
    await ctx.db.delete(row._id);
    return { returnOrigin };
  },
});

export const upsertConnection = internalMutation({
  args: {
    googleEmail: v.string(),
    refreshToken: v.string(),
    accessToken: v.string(),
    accessTokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("gscConnections").first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        googleEmail: args.googleEmail,
        refreshToken: args.refreshToken || existing.refreshToken,
        accessToken: args.accessToken,
        accessTokenExpiresAt: args.accessTokenExpiresAt,
        connectedAt: existing.connectedAt,
        lastSyncError: undefined,
      });
      return existing._id;
    }
    return await ctx.db.insert("gscConnections", {
      googleEmail: args.googleEmail,
      refreshToken: args.refreshToken,
      accessToken: args.accessToken,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      connectedAt: now,
    });
  },
});

export const getConnectionInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("gscConnections").first();
  },
});

export const updateTokens = internalMutation({
  args: {
    connectionId: v.id("gscConnections"),
    accessToken: v.string(),
    accessTokenExpiresAt: v.number(),
    refreshToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: {
      accessToken: string;
      accessTokenExpiresAt: number;
      refreshToken?: string;
    } = {
      accessToken: args.accessToken,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
    };
    if (args.refreshToken) patch.refreshToken = args.refreshToken;
    await ctx.db.patch(args.connectionId, patch);
  },
});

export const listSitesInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("sites").collect();
  },
});

export const upsertMetric = internalMutation({
  args: {
    siteId: v.id("sites"),
    periodDays,
    gscPropertyUrl: v.string(),
    clicks: v.number(),
    impressions: v.number(),
    ctr: v.number(),
    position: v.number(),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("siteSearchMetrics")
      .withIndex("by_site_period", (q) =>
        q.eq("siteId", args.siteId).eq("periodDays", args.periodDays)
      )
      .unique();

    const payload = {
      siteId: args.siteId,
      periodDays: args.periodDays,
      gscPropertyUrl: args.gscPropertyUrl,
      clicks: args.clicks,
      impressions: args.impressions,
      ctr: args.ctr,
      position: args.position,
      startDate: args.startDate,
      endDate: args.endDate,
      syncedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("siteSearchMetrics", payload);
    }
  },
});

export const setSyncResult = internalMutation({
  args: {
    connectionId: v.id("gscConnections"),
    error: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, {
      lastSyncAt: Date.now(),
      lastSyncError: args.error ?? undefined,
    });
  },
});
