import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const strategy = v.union(v.literal("mobile"), v.literal("desktop"));

function mapSyncState(doc: {
  _id: Id<"pagespeedSyncState">;
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
  _id: Id<"sitePerformanceMetrics">;
  siteId: Id<"sites">;
  strategy: "mobile" | "desktop";
  url: string;
  performanceScore?: number;
  accessibilityScore?: number;
  bestPracticesScore?: number;
  seoScore?: number;
  lcpMs?: number;
  cls?: number;
  inpMs?: number;
  fcpMs?: number;
  overallCategory?: string;
  error?: string;
  syncedAt: number;
}) {
  return {
    id: doc._id,
    site_id: doc.siteId,
    strategy: doc.strategy,
    url: doc.url,
    performance_score: doc.performanceScore ?? null,
    accessibility_score: doc.accessibilityScore ?? null,
    best_practices_score: doc.bestPracticesScore ?? null,
    seo_score: doc.seoScore ?? null,
    lcp_ms: doc.lcpMs ?? null,
    cls: doc.cls ?? null,
    inp_ms: doc.inpMs ?? null,
    fcp_ms: doc.fcpMs ?? null,
    overall_category: doc.overallCategory ?? null,
    error: doc.error ?? null,
    synced_at: new Date(doc.syncedAt).toISOString(),
  };
}

export const getSyncState = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const state = await ctx.db.query("pagespeedSyncState").first();
    if (!state) return null;
    return mapSyncState(state);
  },
});

export const listMetrics = query({
  args: { strategy },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const sites = await ctx.db.query("sites").collect();
    const results = [];

    for (const site of sites.sort((a, b) => a.name.localeCompare(b.name))) {
      const metric = await ctx.db
        .query("sitePerformanceMetrics")
        .withIndex("by_site_strategy", (q) =>
          q.eq("siteId", site._id).eq("strategy", args.strategy)
        )
        .unique();

      results.push({
        site: {
          id: site._id,
          slug: site.slug,
          name: site.name,
          domain: site.domain,
          accent_color: site.accentColor,
          performance_url: site.performanceUrl ?? null,
        },
        metrics: metric ? mapMetric(metric) : null,
      });
    }

    return results;
  },
});

export const updatePerformanceUrl = mutation({
  args: {
    siteId: v.id("sites"),
    performanceUrl: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const site = await ctx.db.get(args.siteId);
    if (!site) throw new Error("Site not found");

    const value = args.performanceUrl?.trim() || undefined;
    await ctx.db.patch(args.siteId, { performanceUrl: value });
  },
});

export const clearMetrics = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const metrics = await ctx.db.query("sitePerformanceMetrics").collect();
    for (const m of metrics) {
      await ctx.db.delete(m._id);
    }

    const states = await ctx.db.query("pagespeedSyncState").collect();
    for (const s of states) {
      await ctx.db.delete(s._id);
    }
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
    strategy,
    url: v.string(),
    performanceScore: v.optional(v.number()),
    accessibilityScore: v.optional(v.number()),
    bestPracticesScore: v.optional(v.number()),
    seoScore: v.optional(v.number()),
    lcpMs: v.optional(v.number()),
    cls: v.optional(v.number()),
    inpMs: v.optional(v.number()),
    fcpMs: v.optional(v.number()),
    overallCategory: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sitePerformanceMetrics")
      .withIndex("by_site_strategy", (q) =>
        q.eq("siteId", args.siteId).eq("strategy", args.strategy)
      )
      .unique();

    const payload = {
      siteId: args.siteId,
      strategy: args.strategy,
      url: args.url,
      performanceScore: args.performanceScore,
      accessibilityScore: args.accessibilityScore,
      bestPracticesScore: args.bestPracticesScore,
      seoScore: args.seoScore,
      lcpMs: args.lcpMs,
      cls: args.cls,
      inpMs: args.inpMs,
      fcpMs: args.fcpMs,
      overallCategory: args.overallCategory,
      error: args.error,
      syncedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("sitePerformanceMetrics", payload);
    }
  },
});

export const setSyncResult = internalMutation({
  args: {
    error: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("pagespeedSyncState").first();
    const patch = {
      lastSyncAt: Date.now(),
      lastSyncError: args.error ?? undefined,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("pagespeedSyncState", patch);
    }
  },
});
