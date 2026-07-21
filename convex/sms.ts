import {
  query,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { formatUsPhone, normalizeUsDigits } from "./lib/phone";

function mapDid(doc: Doc<"smsDids">) {
  return {
    id: doc._id,
    did: doc.did,
    description: doc.description,
    sub_account: doc.subAccount ?? null,
    sms_enabled: doc.smsEnabled,
    site_id: doc.siteId ?? null,
    formatted: formatUsPhone(doc.did) ?? doc.did,
    last_synced_at: new Date(doc.lastSyncedAt).toISOString(),
  };
}

function mapMessage(doc: Doc<"smsMessages">) {
  return {
    id: doc._id,
    voipms_id: doc.voipmsId,
    did: doc.did,
    contact: doc.contact,
    contact_formatted: formatUsPhone(doc.contact) ?? doc.contact,
    direction: doc.direction,
    type: doc.type,
    body: doc.body,
    media_urls: doc.mediaUrls ?? [],
    sent_at: new Date(doc.sentAt).toISOString(),
    status: doc.status ?? null,
  };
}

function mapSyncState(doc: Doc<"smsSyncState">) {
  return {
    id: doc._id,
    last_sync_at: doc.lastSyncAt
      ? new Date(doc.lastSyncAt).toISOString()
      : null,
    last_sync_error: doc.lastSyncError ?? null,
    last_did_sync_at: doc.lastDidSyncAt
      ? new Date(doc.lastDidSyncAt).toISOString()
      : null,
  };
}

export const getSyncState = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const state = await ctx.db.query("smsSyncState").first();
    if (!state) return null;
    return mapSyncState(state);
  },
});

export const listDids = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const dids = await ctx.db.query("smsDids").collect();
    return dids
      .map(mapDid)
      .sort((a, b) =>
        (a.description || a.did).localeCompare(b.description || b.did)
      );
  },
});

/** Conversation threads: latest message per (did, contact), optionally filtered by DID. */
export const listThreads = query({
  args: {
    did: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const didFilter = args.did ? normalizeUsDigits(args.did) : null;

    let messages: Doc<"smsMessages">[];
    if (didFilter) {
      messages = await ctx.db
        .query("smsMessages")
        .withIndex("by_did_and_sentAt", (q) => q.eq("did", didFilter))
        .order("desc")
        .take(500);
    } else {
      messages = await ctx.db
        .query("smsMessages")
        .withIndex("by_sentAt")
        .order("desc")
        .take(800);
    }

    const didDocs = await ctx.db.query("smsDids").collect();
    const didMap = new Map(didDocs.map((d) => [d.did, d]));

    const seen = new Set<string>();
    const threads: Array<{
      did: string;
      did_description: string;
      did_formatted: string;
      sub_account: string | null;
      contact: string;
      contact_formatted: string;
      last_body: string;
      last_sent_at: string;
      last_direction: "in" | "out";
      last_type: "sms" | "mms";
      has_media: boolean;
    }> = [];

    for (const msg of messages) {
      const key = `${msg.did}:${msg.contact}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const didDoc = didMap.get(msg.did);
      threads.push({
        did: msg.did,
        did_description: didDoc?.description ?? "",
        did_formatted: formatUsPhone(msg.did) ?? msg.did,
        sub_account: didDoc?.subAccount ?? null,
        contact: msg.contact,
        contact_formatted: formatUsPhone(msg.contact) ?? msg.contact,
        last_body: msg.body,
        last_sent_at: new Date(msg.sentAt).toISOString(),
        last_direction: msg.direction,
        last_type: msg.type,
        has_media: (msg.mediaUrls?.length ?? 0) > 0,
      });
    }

    return threads;
  },
});

export const listMessages = query({
  args: {
    did: v.string(),
    contact: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const did = normalizeUsDigits(args.did);
    const contact = normalizeUsDigits(args.contact);
    if (!did || !contact) return [];

    const messages = await ctx.db
      .query("smsMessages")
      .withIndex("by_did_contact_sentAt", (q) =>
        q.eq("did", did).eq("contact", contact)
      )
      .order("asc")
      .collect();

    return messages.map(mapMessage);
  },
});

export const upsertDidInternal = internalMutation({
  args: {
    did: v.string(),
    description: v.string(),
    subAccount: v.optional(v.string()),
    smsEnabled: v.boolean(),
    siteId: v.optional(v.id("sites")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("smsDids")
      .withIndex("by_did", (q) => q.eq("did", args.did))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        description: args.description,
        subAccount: args.subAccount,
        smsEnabled: args.smsEnabled,
        siteId: args.siteId,
        lastSyncedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("smsDids", {
      did: args.did,
      description: args.description,
      subAccount: args.subAccount,
      smsEnabled: args.smsEnabled,
      siteId: args.siteId,
      lastSyncedAt: now,
    });
  },
});

export const upsertMessageInternal = internalMutation({
  args: {
    voipmsId: v.string(),
    did: v.string(),
    contact: v.string(),
    direction: v.union(v.literal("in"), v.literal("out")),
    type: v.union(v.literal("sms"), v.literal("mms")),
    body: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
    sentAt: v.number(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("smsMessages")
      .withIndex("by_voipms_id", (q) => q.eq("voipmsId", args.voipmsId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        body: args.body,
        mediaUrls: args.mediaUrls,
        type: args.type,
        direction: args.direction,
        sentAt: args.sentAt,
        status: args.status,
      });
      return existing._id;
    }

    return await ctx.db.insert("smsMessages", {
      voipmsId: args.voipmsId,
      did: args.did,
      contact: args.contact,
      direction: args.direction,
      type: args.type,
      body: args.body,
      mediaUrls: args.mediaUrls,
      sentAt: args.sentAt,
      status: args.status,
    });
  },
});

export const setSyncStateInternal = internalMutation({
  args: {
    lastSyncAt: v.optional(v.number()),
    lastSyncError: v.optional(v.union(v.string(), v.null())),
    lastDidSyncAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("smsSyncState").first();
    const patch: {
      lastSyncAt?: number;
      lastSyncError?: string;
      lastDidSyncAt?: number;
    } = {};
    if (args.lastSyncAt !== undefined) patch.lastSyncAt = args.lastSyncAt;
    if (args.lastDidSyncAt !== undefined) {
      patch.lastDidSyncAt = args.lastDidSyncAt;
    }
    if (args.lastSyncError === null) {
      patch.lastSyncError = undefined;
    } else if (args.lastSyncError !== undefined) {
      patch.lastSyncError = args.lastSyncError;
    }

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("smsSyncState", {
      lastSyncAt: args.lastSyncAt,
      lastSyncError:
        args.lastSyncError === null ? undefined : args.lastSyncError,
      lastDidSyncAt: args.lastDidSyncAt,
    });
  },
});

export const listDidsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("smsDids").collect();
  },
});

export const listSitesForPhoneMatchInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const sites = await ctx.db.query("sites").collect();
    return sites.map((s) => ({
      _id: s._id,
      phoneNumber: s.phoneNumber,
      name: s.name,
    }));
  },
});
