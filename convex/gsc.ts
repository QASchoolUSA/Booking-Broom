import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { formatDateUTC } from "./lib/gscMatch";

const periodDays = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(7),
  v.literal(28),
  v.literal(90)
);

const topQuery = v.object({
  query: v.string(),
  clicks: v.number(),
  impressions: v.number(),
  ctr: v.number(),
  position: v.number(),
});

type PeriodDays = 1 | 2 | 7 | 28 | 90;

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
  periodDays: PeriodDays;
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

type MetricValues = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

function computeDelta(
  current: MetricValues,
  previous: MetricValues,
  comparedTo: string
) {
  return {
    clicks: current.clicks - previous.clicks,
    impressions: current.impressions - previous.impressions,
    ctr: current.ctr - previous.ctr,
    position: current.position - previous.position,
    compared_to: comparedTo,
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
    const today = formatDateUTC(new Date());
    const results = [];

    for (const site of sites.sort((a, b) => a.name.localeCompare(b.name))) {
      const metric = await ctx.db
        .query("siteSearchMetrics")
        .withIndex("by_site_period", (q) =>
          q.eq("siteId", site._id).eq("periodDays", args.periodDays)
        )
        .unique();

      const propertyStatus = await ctx.db
        .query("siteSearchPropertyStatus")
        .withIndex("by_site_source", (q) =>
          q.eq("siteId", site._id).eq("source", "google")
        )
        .unique();

      const pageScan = await ctx.db
        .query("sitePageScans")
        .withIndex("by_site", (q) => q.eq("siteId", site._id))
        .unique();

      const queryDoc = await ctx.db
        .query("siteSearchQueries")
        .withIndex("by_site_period", (q) =>
          q.eq("siteId", site._id).eq("periodDays", args.periodDays)
        )
        .unique();

      let delta: ReturnType<typeof computeDelta> | null = null;

      if (metric) {
        const history = await ctx.db
          .query("siteSearchMetricsHistory")
          .withIndex("by_site_period_date", (q) =>
            q.eq("siteId", site._id).eq("periodDays", args.periodDays)
          )
          .collect();

        const prior = history
          .filter((h) => h.snapshotDate < today)
          .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))[0];

        if (prior) {
          delta = computeDelta(metric, prior, prior.snapshotDate);
        }
      }

      results.push({
        site: {
          id: site._id,
          slug: site.slug,
          name: site.name,
          domain: site.domain,
          accent_color: site.accentColor,
          bing_property_url: site.bingPropertyUrl ?? null,
        },
        property_status: propertyStatus
          ? propertyStatus.status
          : ("unconfigured" as const),
        property_url: propertyStatus?.propertyUrl ?? null,
        metrics: metric ? mapMetric(metric) : null,
        delta,
        top_queries: queryDoc?.queries?.length ? queryDoc.queries : null,
        crawl_issues: null,
        page_scan: pageScan
          ? {
              scanned_url: pageScan.scannedUrl,
              score: pageScan.score,
              passed: pageScan.passed,
              total: pageScan.total,
              checks: pageScan.checks,
              error: pageScan.error ?? null,
              scanned_at: new Date(pageScan.scannedAt).toISOString(),
            }
          : null,
      });
    }

    return results;
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

    const history = await ctx.db.query("siteSearchMetricsHistory").collect();
    for (const h of history) {
      await ctx.db.delete(h._id);
    }

    const queries = await ctx.db.query("siteSearchQueries").collect();
    for (const q of queries) {
      await ctx.db.delete(q._id);
    }

    const statuses = await ctx.db.query("siteSearchPropertyStatus").collect();
    for (const s of statuses) {
      if (s.source === "google") await ctx.db.delete(s._id);
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

/** Remove legacy GSC property overrides from site docs (field removed from schema). */
export const stripGscPropertyOverrides = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sites = await ctx.db.query("sites").collect();
    for (const site of sites) {
      const legacy = site as typeof site & { gscPropertyUrl?: string };
      if (legacy.gscPropertyUrl === undefined) continue;
      const {
        _id,
        _creationTime,
        gscPropertyUrl: _removed,
        ...fields
      } = legacy;
      await ctx.db.replace(_id, fields);
    }
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
    const syncedAt = Date.now();
    const snapshotDate = formatDateUTC(new Date(syncedAt));

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
      syncedAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("siteSearchMetrics", payload);
    }

    const historyPayload = {
      siteId: args.siteId,
      periodDays: args.periodDays,
      snapshotDate,
      gscPropertyUrl: args.gscPropertyUrl,
      clicks: args.clicks,
      impressions: args.impressions,
      ctr: args.ctr,
      position: args.position,
      startDate: args.startDate,
      endDate: args.endDate,
      syncedAt,
    };

    const existingHistory = await ctx.db
      .query("siteSearchMetricsHistory")
      .withIndex("by_site_period_date", (q) =>
        q
          .eq("siteId", args.siteId)
          .eq("periodDays", args.periodDays)
          .eq("snapshotDate", snapshotDate)
      )
      .unique();

    if (existingHistory) {
      await ctx.db.patch(existingHistory._id, historyPayload);
    } else {
      await ctx.db.insert("siteSearchMetricsHistory", historyPayload);
    }
  },
});

export const upsertQueries = internalMutation({
  args: {
    siteId: v.id("sites"),
    periodDays,
    queries: v.array(topQuery),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("siteSearchQueries")
      .withIndex("by_site_period", (q) =>
        q.eq("siteId", args.siteId).eq("periodDays", args.periodDays)
      )
      .unique();

    const payload = {
      siteId: args.siteId,
      periodDays: args.periodDays,
      queries: args.queries,
      syncedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("siteSearchQueries", payload);
    }
  },
});

export const upsertPropertyStatus = internalMutation({
  args: {
    siteId: v.id("sites"),
    status: v.union(v.literal("matched"), v.literal("not_in_console")),
    propertyUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("siteSearchPropertyStatus")
      .withIndex("by_site_source", (q) =>
        q.eq("siteId", args.siteId).eq("source", "google")
      )
      .unique();

    const payload = {
      siteId: args.siteId,
      source: "google" as const,
      status: args.status,
      propertyUrl: args.propertyUrl,
      syncedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.replace(existing._id, payload);
    } else {
      await ctx.db.insert("siteSearchPropertyStatus", payload);
    }
  },
});

export const clearSiteMetrics = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    const metrics = await ctx.db
      .query("siteSearchMetrics")
      .withIndex("by_site_period", (q) => q.eq("siteId", args.siteId))
      .collect();
    for (const m of metrics) await ctx.db.delete(m._id);

    const history = await ctx.db
      .query("siteSearchMetricsHistory")
      .withIndex("by_site_period_date", (q) => q.eq("siteId", args.siteId))
      .collect();
    for (const h of history) await ctx.db.delete(h._id);

    const queries = await ctx.db
      .query("siteSearchQueries")
      .withIndex("by_site_period", (q) => q.eq("siteId", args.siteId))
      .collect();
    for (const q of queries) await ctx.db.delete(q._id);
  },
});

/** Delete all Google Search Console metric snapshots (used before each sync). */
export const wipeGoogleSearchMetricsInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const metrics = await ctx.db.query("siteSearchMetrics").collect();
    for (const row of metrics) await ctx.db.delete(row._id);

    const history = await ctx.db.query("siteSearchMetricsHistory").collect();
    for (const row of history) await ctx.db.delete(row._id);

    const queries = await ctx.db.query("siteSearchQueries").collect();
    for (const row of queries) await ctx.db.delete(row._id);

    return {
      metrics: metrics.length,
      history: history.length,
      queries: queries.length,
    };
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

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const pruneHistory = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const stale = await ctx.db
      .query("siteSearchMetricsHistory")
      .withIndex("by_synced_at", (q) => q.lt("syncedAt", cutoff))
      .collect();

    for (const row of stale) {
      await ctx.db.delete(row._id);
    }

    return { deleted: stale.length };
  },
});
