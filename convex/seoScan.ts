import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const scanCheck = v.object({
  id: v.string(),
  label: v.string(),
  pass: v.boolean(),
  detail: v.optional(v.string()),
});

function mapScan(doc: {
  _id: Id<"sitePageScans">;
  siteId: Id<"sites">;
  scannedUrl: string;
  score: number;
  passed: number;
  total: number;
  checks: {
    id: string;
    label: string;
    pass: boolean;
    detail?: string;
  }[];
  error?: string;
  scannedAt: number;
}) {
  return {
    id: doc._id,
    site_id: doc.siteId,
    scanned_url: doc.scannedUrl,
    score: doc.score,
    passed: doc.passed,
    total: doc.total,
    checks: doc.checks,
    error: doc.error ?? null,
    scanned_at: new Date(doc.scannedAt).toISOString(),
  };
}

export const listScans = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const sites = await ctx.db.query("sites").collect();
    const results = [];
    for (const site of sites.sort((a, b) => a.name.localeCompare(b.name))) {
      const scan = await ctx.db
        .query("sitePageScans")
        .withIndex("by_site", (q) => q.eq("siteId", site._id))
        .unique();
      results.push({
        site_id: site._id,
        scan: scan ? mapScan(scan) : null,
      });
    }
    return results;
  },
});

export const clearScans = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    for (const row of await ctx.db.query("sitePageScans").collect()) {
      await ctx.db.delete(row._id);
    }
  },
});

export const getSiteInternal = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.siteId);
  },
});

export const listSitesInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("sites").collect();
  },
});

export const upsertScan = internalMutation({
  args: {
    siteId: v.id("sites"),
    scannedUrl: v.string(),
    score: v.number(),
    passed: v.number(),
    total: v.number(),
    checks: v.array(scanCheck),
    error: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sitePageScans")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .unique();

    const doc = {
      siteId: args.siteId,
      scannedUrl: args.scannedUrl,
      score: args.score,
      passed: args.passed,
      total: args.total,
      checks: args.checks,
      scannedAt: Date.now(),
      ...(typeof args.error === "string" && args.error.length > 0
        ? { error: args.error }
        : {}),
    };

    if (existing) {
      await ctx.db.replace(existing._id, doc);
    } else {
      await ctx.db.insert("sitePageScans", doc);
    }
  },
});
