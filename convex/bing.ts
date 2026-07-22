import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  formatDateUTC,
  PERIOD_TODAY,
  PERIOD_YESTERDAY,
} from "./lib/gscMatch";

const periodDays = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(7),
  v.literal(28),
  v.literal(90)
);

type PeriodDays = 1 | 2 | 7 | 28 | 90;

const crawlIssue = v.object({
  url: v.string(),
  httpCode: v.number(),
  issues: v.number(),
  inLinks: v.number(),
});

function mapSyncState(doc: {
  _id: Id<"bingSyncState">;
  lastSyncAt?: number;
  lastSyncError?: string;
}) {
  return {
    id: doc._id,
    last_sync_at: doc.lastSyncAt
      ? new Date(doc.lastSyncAt).toISOString()
      : null,
    last_sync_error: doc.lastSyncError ?? null,
  };
}

function mapMetric(doc: {
  _id: Id<"siteBingSearchMetrics">;
  siteId: Id<"sites">;
  periodDays: PeriodDays;
  bingPropertyUrl: string;
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
    bing_property_url: doc.bingPropertyUrl,
    gsc_property_url: doc.bingPropertyUrl,
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

export const getSyncState = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const state = await ctx.db.query("bingSyncState").first();
    if (!state) return null;
    return mapSyncState(state);
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
        .query("siteBingSearchMetrics")
        .withIndex("by_site_period", (q) =>
          q.eq("siteId", site._id).eq("periodDays", args.periodDays)
        )
        .unique();

      const propertyStatus = await ctx.db
        .query("siteSearchPropertyStatus")
        .withIndex("by_site_source", (q) =>
          q.eq("siteId", site._id).eq("source", "bing")
        )
        .unique();

      const crawl = await ctx.db
        .query("siteBingCrawlIssues")
        .withIndex("by_site", (q) => q.eq("siteId", site._id))
        .unique();

      const pageScan = await ctx.db
        .query("sitePageScans")
        .withIndex("by_site", (q) => q.eq("siteId", site._id))
        .unique();

      let delta: ReturnType<typeof computeDelta> | null = null;

      if (metric) {
        if (args.periodDays === PERIOD_TODAY) {
          const yesterday = await ctx.db
            .query("siteBingSearchMetrics")
            .withIndex("by_site_period", (q) =>
              q.eq("siteId", site._id).eq("periodDays", PERIOD_YESTERDAY)
            )
            .unique();
          if (yesterday) {
            delta = computeDelta(metric, yesterday, "yesterday");
          }
        }

        if (!delta) {
          const history = await ctx.db
            .query("siteBingSearchMetricsHistory")
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
      }

      results.push({
        site: {
          id: site._id,
          slug: site.slug,
          name: site.name,
          domain: site.domain,
          accent_color: site.accentColor,
          gsc_property_url: site.gscPropertyUrl ?? null,
          bing_property_url: site.bingPropertyUrl ?? null,
        },
        property_status: propertyStatus
          ? propertyStatus.status
          : ("unconfigured" as const),
        property_url: propertyStatus?.propertyUrl ?? null,
        metrics: metric ? mapMetric(metric) : null,
        delta,
        crawl_issues: crawl
          ? {
              issue_count: crawl.issueCount,
              issues: crawl.issues,
              synced_at: new Date(crawl.syncedAt).toISOString(),
            }
          : null,
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

export const updateBingProperty = mutation({
  args: {
    siteId: v.id("sites"),
    bingPropertyUrl: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const site = await ctx.db.get(args.siteId);
    if (!site) throw new Error("Site not found");

    const value = args.bingPropertyUrl?.trim() || undefined;
    await ctx.db.patch(args.siteId, { bingPropertyUrl: value });
  },
});

export const clearMetrics = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    for (const m of await ctx.db.query("siteBingSearchMetrics").collect()) {
      await ctx.db.delete(m._id);
    }
    for (const h of await ctx.db
      .query("siteBingSearchMetricsHistory")
      .collect()) {
      await ctx.db.delete(h._id);
    }
    for (const c of await ctx.db.query("siteBingCrawlIssues").collect()) {
      await ctx.db.delete(c._id);
    }
    for (const s of await ctx.db
      .query("siteSearchPropertyStatus")
      .collect()) {
      if (s.source === "bing") await ctx.db.delete(s._id);
    }
    for (const st of await ctx.db.query("bingSyncState").collect()) {
      await ctx.db.delete(st._id);
    }
  },
});

export const listSitesInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("sites").collect();
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
        q.eq("siteId", args.siteId).eq("source", "bing")
      )
      .unique();

    const payload = {
      siteId: args.siteId,
      source: "bing" as const,
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
      .query("siteBingSearchMetrics")
      .withIndex("by_site_period", (q) => q.eq("siteId", args.siteId))
      .collect();
    for (const m of metrics) await ctx.db.delete(m._id);

    const history = await ctx.db
      .query("siteBingSearchMetricsHistory")
      .withIndex("by_site_period_date", (q) => q.eq("siteId", args.siteId))
      .collect();
    for (const h of history) await ctx.db.delete(h._id);

    const crawl = await ctx.db
      .query("siteBingCrawlIssues")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .unique();
    if (crawl) await ctx.db.delete(crawl._id);
  },
});

export const upsertMetric = internalMutation({
  args: {
    siteId: v.id("sites"),
    periodDays,
    bingPropertyUrl: v.string(),
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
      .query("siteBingSearchMetrics")
      .withIndex("by_site_period", (q) =>
        q.eq("siteId", args.siteId).eq("periodDays", args.periodDays)
      )
      .unique();

    const payload = {
      siteId: args.siteId,
      periodDays: args.periodDays,
      bingPropertyUrl: args.bingPropertyUrl,
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
      await ctx.db.insert("siteBingSearchMetrics", payload);
    }

    const historyPayload = {
      siteId: args.siteId,
      periodDays: args.periodDays,
      snapshotDate,
      bingPropertyUrl: args.bingPropertyUrl,
      clicks: args.clicks,
      impressions: args.impressions,
      ctr: args.ctr,
      position: args.position,
      startDate: args.startDate,
      endDate: args.endDate,
      syncedAt,
    };

    const existingHistory = await ctx.db
      .query("siteBingSearchMetricsHistory")
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
      await ctx.db.insert("siteBingSearchMetricsHistory", historyPayload);
    }
  },
});

export const upsertCrawlIssues = internalMutation({
  args: {
    siteId: v.id("sites"),
    issueCount: v.number(),
    issues: v.array(crawlIssue),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("siteBingCrawlIssues")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .unique();

    const payload = {
      siteId: args.siteId,
      issueCount: args.issueCount,
      issues: args.issues,
      syncedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.replace(existing._id, payload);
    } else {
      await ctx.db.insert("siteBingCrawlIssues", payload);
    }
  },
});

export const setSyncResult = internalMutation({
  args: {
    error: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("bingSyncState").first();
    const patch = {
      lastSyncAt: Date.now(),
      lastSyncError: args.error ?? undefined,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("bingSyncState", patch);
    }
  },
});

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const pruneHistory = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const stale = await ctx.db
      .query("siteBingSearchMetricsHistory")
      .withIndex("by_synced_at", (q) => q.lt("syncedAt", cutoff))
      .collect();

    for (const row of stale) {
      await ctx.db.delete(row._id);
    }

    return { deleted: stale.length };
  },
});
