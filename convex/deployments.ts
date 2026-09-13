import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { BOOKING_BROOM_WORKER } from "./lib/apiKeys";

/** Workers Free plan daily request limit (resets midnight UTC). */
const WORKERS_FREE_REQUESTS_PER_DAY = 100_000;

function mapSyncState(doc: {
  _id: Id<"deploymentSyncState">;
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

function mapDeployment(doc: Doc<"deploymentStatus">) {
  const requestsToday = doc.requestsToday ?? null;
  const requestsLimit = doc.requestsLimit ?? WORKERS_FREE_REQUESTS_PER_DAY;
  const requestsRemaining =
    requestsToday != null
      ? Math.max(0, requestsLimit - requestsToday)
      : null;

  return {
    id: doc._id,
    worker_name: doc.workerName,
    site_id: doc.siteId ?? null,
    display_name: doc.displayName,
    account_id: doc.accountId ?? null,
    status: doc.status ?? null,
    build_outcome: doc.buildOutcome ?? null,
    branch: doc.branch ?? null,
    commit_hash: doc.commitHash ?? null,
    commit_message: doc.commitMessage ?? null,
    author: doc.author ?? null,
    created_on: doc.createdOn
      ? new Date(doc.createdOn).toISOString()
      : null,
    stopped_on: doc.stoppedOn
      ? new Date(doc.stoppedOn).toISOString()
      : null,
    build_uuid: doc.buildUuid ?? null,
    dashboard_url: doc.dashboardUrl ?? null,
    requests_today: requestsToday,
    requests_limit: requestsLimit,
    requests_remaining: requestsRemaining,
    build_minutes_limit_reached: doc.buildMinutesLimitReached ?? null,
    build_minutes_refresh_on: doc.buildMinutesRefreshOn
      ? new Date(doc.buildMinutesRefreshOn).toISOString()
      : null,
    error: doc.error ?? null,
    checked_at: new Date(doc.checkedAt).toISOString(),
  };
}

export const getSyncState = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const state = await ctx.db.query("deploymentSyncState").first();
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
    const statuses = await ctx.db.query("deploymentStatus").collect();
    const byWorker = new Map(statuses.map((s) => [s.workerName, s]));

    const results: Array<{
      target: {
        kind: "app" | "site";
        site_id: Id<"sites"> | null;
        slug: string;
        name: string;
        domain: string | null;
        accent_color: string;
        worker_name: string | null;
        cloudflare_account_id: string | null;
      };
      deployment: ReturnType<typeof mapDeployment> | null;
    }> = [];

    // Booking Broom app first (Account ID comes from CLOUDFLARE_ACCOUNT_ID env).
    const bbStatus = byWorker.get(BOOKING_BROOM_WORKER.workerName);
    results.push({
      target: {
        kind: "app",
        site_id: null,
        slug: "booking-broom",
        name: BOOKING_BROOM_WORKER.displayName,
        domain: null,
        accent_color: BOOKING_BROOM_WORKER.accentColor,
        worker_name: BOOKING_BROOM_WORKER.workerName,
        cloudflare_account_id: bbStatus?.accountId ?? null,
      },
      deployment: bbStatus ? mapDeployment(bbStatus) : null,
    });

    for (const site of sites.sort((a, b) => a.name.localeCompare(b.name))) {
      const workerName = site.cloudflareWorkerName ?? null;
      const status = workerName ? byWorker.get(workerName) : undefined;
      results.push({
        target: {
          kind: "site",
          site_id: site._id,
          slug: site.slug,
          name: site.name,
          domain: site.domain,
          accent_color: site.accentColor,
          worker_name: workerName,
          cloudflare_account_id: site.cloudflareAccountId ?? null,
        },
        deployment: status ? mapDeployment(status) : null,
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

    const rows = await ctx.db.query("deploymentStatus").collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    const states = await ctx.db.query("deploymentSyncState").collect();
    for (const s of states) {
      await ctx.db.delete(s._id);
    }
  },
});

/** Set Cloudflare Account ID for a cleaning site (paste from CF dashboard). */
export const updateCloudflareAccountId = mutation({
  args: {
    siteId: v.id("sites"),
    cloudflareAccountId: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const site = await ctx.db.get(args.siteId);
    if (!site) throw new Error("Site not found");

    const value = args.cloudflareAccountId?.trim() || undefined;
    await ctx.db.patch(args.siteId, { cloudflareAccountId: value });
  },
});

export const listTargetsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const sites = await ctx.db.query("sites").collect();
    return {
      bookingBroom: BOOKING_BROOM_WORKER,
      sites: sites.map((s) => ({
        _id: s._id,
        slug: s.slug,
        name: s.name,
        domain: s.domain,
        cloudflareWorkerName: s.cloudflareWorkerName,
        cloudflareAccountId: s.cloudflareAccountId,
      })),
    };
  },
});

export const upsertStatus = internalMutation({
  args: {
    workerName: v.string(),
    siteId: v.optional(v.id("sites")),
    displayName: v.string(),
    accountId: v.optional(v.union(v.string(), v.null())),
    status: v.optional(v.union(v.string(), v.null())),
    buildOutcome: v.optional(v.union(v.string(), v.null())),
    branch: v.optional(v.union(v.string(), v.null())),
    commitHash: v.optional(v.union(v.string(), v.null())),
    commitMessage: v.optional(v.union(v.string(), v.null())),
    author: v.optional(v.union(v.string(), v.null())),
    createdOn: v.optional(v.union(v.number(), v.null())),
    stoppedOn: v.optional(v.union(v.number(), v.null())),
    buildUuid: v.optional(v.union(v.string(), v.null())),
    dashboardUrl: v.optional(v.union(v.string(), v.null())),
    requestsToday: v.optional(v.union(v.number(), v.null())),
    requestsLimit: v.optional(v.union(v.number(), v.null())),
    buildMinutesLimitReached: v.optional(v.union(v.boolean(), v.null())),
    buildMinutesRefreshOn: v.optional(v.union(v.number(), v.null())),
    error: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("deploymentStatus")
      .withIndex("by_worker", (q) => q.eq("workerName", args.workerName))
      .unique();

    const doc = {
      workerName: args.workerName,
      ...(args.siteId != null ? { siteId: args.siteId } : {}),
      displayName: args.displayName,
      checkedAt: Date.now(),
      ...(typeof args.accountId === "string" && args.accountId.length > 0
        ? { accountId: args.accountId }
        : {}),
      ...(typeof args.status === "string" && args.status.length > 0
        ? { status: args.status }
        : {}),
      ...(typeof args.buildOutcome === "string" && args.buildOutcome.length > 0
        ? { buildOutcome: args.buildOutcome }
        : {}),
      ...(typeof args.branch === "string" && args.branch.length > 0
        ? { branch: args.branch }
        : {}),
      ...(typeof args.commitHash === "string" && args.commitHash.length > 0
        ? { commitHash: args.commitHash }
        : {}),
      ...(typeof args.commitMessage === "string" &&
      args.commitMessage.length > 0
        ? { commitMessage: args.commitMessage }
        : {}),
      ...(typeof args.author === "string" && args.author.length > 0
        ? { author: args.author }
        : {}),
      ...(typeof args.createdOn === "number"
        ? { createdOn: args.createdOn }
        : {}),
      ...(typeof args.stoppedOn === "number"
        ? { stoppedOn: args.stoppedOn }
        : {}),
      ...(typeof args.buildUuid === "string" && args.buildUuid.length > 0
        ? { buildUuid: args.buildUuid }
        : {}),
      ...(typeof args.dashboardUrl === "string" && args.dashboardUrl.length > 0
        ? { dashboardUrl: args.dashboardUrl }
        : {}),
      ...(typeof args.requestsToday === "number"
        ? { requestsToday: args.requestsToday }
        : {}),
      ...(typeof args.requestsLimit === "number"
        ? { requestsLimit: args.requestsLimit }
        : {}),
      ...(typeof args.buildMinutesLimitReached === "boolean"
        ? { buildMinutesLimitReached: args.buildMinutesLimitReached }
        : {}),
      ...(typeof args.buildMinutesRefreshOn === "number"
        ? { buildMinutesRefreshOn: args.buildMinutesRefreshOn }
        : {}),
      ...(typeof args.error === "string" && args.error.length > 0
        ? { error: args.error }
        : {}),
    };

    if (existing) {
      await ctx.db.replace(existing._id, doc);
    } else {
      await ctx.db.insert("deploymentStatus", doc);
    }
  },
});

export const setSyncResult = internalMutation({
  args: {
    error: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("deploymentSyncState").first();
    const patch = {
      lastSyncAt: Date.now(),
      lastSyncError: args.error ?? undefined,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("deploymentSyncState", patch);
    }
  },
});
