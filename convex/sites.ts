import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

const hostingProvider = v.union(v.literal("vercel"), v.literal("cloudflare"));

function mapSite(doc: Doc<"sites">) {
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
    gsc_property_url: doc.gscPropertyUrl ?? null,
    performance_url: doc.performanceUrl ?? null,
    created_at: new Date(doc.createdAt).toISOString(),
  };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const sites = await ctx.db.query("sites").collect();
    return sites
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(mapSite);
  },
});

export const updateHosting = mutation({
  args: {
    siteId: v.id("sites"),
    hostingProvider: v.union(hostingProvider, v.null()),
    hostingAccountEmail: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const site = await ctx.db.get(args.siteId);
    if (!site) throw new Error("Site not found");

    const email = args.hostingAccountEmail?.trim() || null;

    await ctx.db.patch(args.siteId, {
      hostingProvider: args.hostingProvider ?? undefined,
      hostingAccountEmail: email ?? undefined,
    });
  },
});

export const updateOps = mutation({
  args: {
    siteId: v.id("sites"),
    hostingProvider: v.union(hostingProvider, v.null()),
    hostingAccountEmail: v.union(v.string(), v.null()),
    phoneNumber: v.union(v.string(), v.null()),
    emailConfigured: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const site = await ctx.db.get(args.siteId);
    if (!site) throw new Error("Site not found");

    const hostingEmail = args.hostingAccountEmail?.trim() || null;
    const phone = args.phoneNumber?.trim() || null;

    await ctx.db.patch(args.siteId, {
      hostingProvider: args.hostingProvider ?? undefined,
      hostingAccountEmail: hostingEmail ?? undefined,
      phoneNumber: phone ?? undefined,
      emailConfigured: args.emailConfigured,
    });
  },
});

export const getBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});
