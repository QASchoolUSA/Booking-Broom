import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

const healthStatus = v.union(v.literal("online"), v.literal("offline"));

function mapSyncState(doc: {
  _id: Id<"siteHealthSyncState">;
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

function mapHealth(doc: Doc<"siteHealthStatus">) {
  return {
    id: doc._id,
    site_id: doc.siteId,
    status: doc.status,
    checked_url: doc.checkedUrl,
    http_status: doc.httpStatus ?? null,
    error: doc.error ?? null,
    checked_at: new Date(doc.checkedAt).toISOString(),
  };
}

function mapSiteOps(doc: Doc<"sites">) {
  return {
    id: doc._id,
    slug: doc.slug,
    name: doc.name,
    domain: doc.domain,
    accent_color: doc.accentColor,
    contact_email: doc.contactEmail ?? null,
    hosting_provider: doc.hostingProvider ?? null,
    hosting_account_email: doc.hostingAccountEmail ?? null,
    phone_number: doc.phoneNumber ?? null,
    email_configured: doc.emailConfigured ?? false,
  };
}

export const getSyncState = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const state = await ctx.db.query("siteHealthSyncState").first();
    if (!state) return null;
    return mapSyncState(state);
  },
});

export const listStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const sites = await ctx.db.query("sites").collect();
    const results = [];

    for (const site of sites.sort((a, b) => a.name.localeCompare(b.name))) {
      const health = await ctx.db
        .query("siteHealthStatus")
        .withIndex("by_site", (q) => q.eq("siteId", site._id))
        .unique();

      results.push({
        site: mapSiteOps(site),
        health: health ? mapHealth(health) : null,
      });
    }

    return results;
  },
});

export const clearStatus = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const rows = await ctx.db.query("siteHealthStatus").collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    const states = await ctx.db.query("siteHealthSyncState").collect();
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

export const getSiteInternal = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.siteId);
  },
});

export const upsertStatus = internalMutation({
  args: {
    siteId: v.id("sites"),
    status: healthStatus,
    checkedUrl: v.string(),
    httpStatus: v.optional(v.number()),
    error: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("siteHealthStatus")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .unique();

    const doc = {
      siteId: args.siteId,
      status: args.status,
      checkedUrl: args.checkedUrl,
      checkedAt: Date.now(),
      ...(args.httpStatus != null && { httpStatus: args.httpStatus }),
      ...(typeof args.error === "string" && args.error.length > 0
        ? { error: args.error }
        : {}),
    };

    if (existing) {
      await ctx.db.replace(existing._id, doc);
    } else {
      await ctx.db.insert("siteHealthStatus", doc);
    }
  },
});

export const setSyncResult = internalMutation({
  args: {
    error: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("siteHealthSyncState").first();
    const patch = {
      lastSyncAt: Date.now(),
      lastSyncError: args.error ?? undefined,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("siteHealthSyncState", patch);
    }
  },
});
