import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { pricingConfig } from "./lib/pricingConfigs";
import { computeReferenceBasket } from "./lib/pricingEngines";
import { SEED_PRICING } from "./lib/pricingSeed";

function mapPricing(doc: Doc<"sitePricing">) {
  return {
    id: doc._id,
    site_id: doc.siteId,
    engine: doc.engine,
    currency: doc.currency,
    config: doc.config,
    version: doc.version,
    updated_at: new Date(doc.updatedAt).toISOString(),
  };
}

/**
 * Every site with its pricing config and the reference-basket prices derived
 * from it. Sites with no config row yet come back with `pricing: null`.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const sites = await ctx.db.query("sites").collect();
    const results = [];

    for (const site of sites.sort((a, b) => a.name.localeCompare(b.name))) {
      const pricing = await ctx.db
        .query("sitePricing")
        .withIndex("by_site", (q) => q.eq("siteId", site._id))
        .unique();

      results.push({
        site: {
          id: site._id,
          slug: site.slug,
          name: site.name,
          domain: site.domain,
          accent_color: site.accentColor,
        },
        pricing: pricing ? mapPricing(pricing) : null,
        basket: pricing ? computeReferenceBasket(pricing.config) : null,
      });
    }

    return results;
  },
});

export const get = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const pricing = await ctx.db
      .query("sitePricing")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .unique();

    return pricing ? mapPricing(pricing) : null;
  },
});

export const listHistory = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const rows = await ctx.db
      .query("sitePricingHistory")
      .withIndex("by_site_version", (q) => q.eq("siteId", args.siteId))
      .collect();

    return rows
      .sort((a, b) => b.version - a.version)
      .map((row) => ({
        id: row._id,
        version: row.version,
        summary: row.summary,
        changed_at: new Date(row.changedAt).toISOString(),
      }));
  },
});

/**
 * Save new numbers for a site. The engine cannot change: a config shaped for a
 * different algorithm would be meaningless to the site consuming it.
 */
export const updateConfig = mutation({
  args: {
    siteId: v.id("sites"),
    config: pricingConfig,
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const site = await ctx.db.get(args.siteId);
    if (!site) throw new Error("Site not found");

    const existing = await ctx.db
      .query("sitePricing")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .unique();

    if (!existing) throw new Error("This site has no pricing config yet");
    if (existing.config.kind !== args.config.kind) {
      throw new Error(
        `Cannot change pricing engine from ${existing.config.kind} to ${args.config.kind}`
      );
    }

    const now = Date.now();

    await ctx.db.insert("sitePricingHistory", {
      siteId: args.siteId,
      version: existing.version,
      engine: existing.engine,
      currency: existing.currency,
      config: existing.config,
      summary: args.summary,
      changedAt: now,
    });

    await ctx.db.patch(existing._id, {
      config: args.config,
      version: existing.version + 1,
      updatedAt: now,
    });

    return { version: existing.version + 1 };
  },
});

export const revertToVersion = mutation({
  args: { siteId: v.id("sites"), version: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const snapshot = await ctx.db
      .query("sitePricingHistory")
      .withIndex("by_site_version", (q) =>
        q.eq("siteId", args.siteId).eq("version", args.version)
      )
      .unique();

    if (!snapshot) throw new Error("That version no longer exists");

    const existing = await ctx.db
      .query("sitePricing")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .unique();

    if (!existing) throw new Error("This site has no pricing config yet");

    const now = Date.now();

    await ctx.db.insert("sitePricingHistory", {
      siteId: args.siteId,
      version: existing.version,
      engine: existing.engine,
      currency: existing.currency,
      config: existing.config,
      summary: `Replaced by a revert to v${args.version}`,
      changedAt: now,
    });

    await ctx.db.patch(existing._id, {
      config: snapshot.config,
      version: existing.version + 1,
      updatedAt: now,
    });

    return { version: existing.version + 1 };
  },
});

/**
 * Restore a site's pricing to the values it shipped with. Useful when an edit
 * turns out to be wrong and there is no history to roll back to.
 */
export const resetToDefaults = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const site = await ctx.db.get(args.siteId);
    if (!site) throw new Error("Site not found");

    const seed = SEED_PRICING.find((s) => s.slug === site.slug);
    if (!seed) throw new Error(`No default pricing exists for ${site.slug}`);

    const existing = await ctx.db
      .query("sitePricing")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .unique();

    const now = Date.now();

    if (!existing) {
      await ctx.db.insert("sitePricing", {
        siteId: args.siteId,
        engine: seed.engine,
        currency: seed.currency,
        config: seed.config,
        version: 1,
        updatedAt: now,
      });
      return { version: 1 };
    }

    await ctx.db.insert("sitePricingHistory", {
      siteId: args.siteId,
      version: existing.version,
      engine: existing.engine,
      currency: existing.currency,
      config: existing.config,
      summary: "Replaced by a reset to shipped defaults",
      changedAt: now,
    });

    await ctx.db.patch(existing._id, {
      engine: seed.engine,
      currency: seed.currency,
      config: seed.config,
      version: existing.version + 1,
      updatedAt: now,
    });

    return { version: existing.version + 1 };
  },
});

/**
 * Credential-checked read behind the public pricing API. Unauthenticated by
 * design — a site proves itself with its slug and API key, exactly as it does
 * when posting a booking. The check lives here rather than in the route so the
 * same rules apply however the config is fetched.
 */
export const getForSite = query({
  args: { slug: v.string(), apiKeyHash: v.string() },
  handler: async (ctx, args) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!site) throw new Error("Invalid site");
    if (site.apiKeyHash !== args.apiKeyHash) throw new Error("Invalid API key");

    const pricing = await ctx.db
      .query("sitePricing")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .unique();

    if (!pricing) throw new Error("No pricing configured");

    return {
      engine: pricing.engine,
      currency: pricing.currency,
      config: pricing.config,
      version: pricing.version,
      updated_at: new Date(pricing.updatedAt).toISOString(),
    };
  },
});
