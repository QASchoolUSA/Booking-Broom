import { internalMutation, mutation } from "./_generated/server";
import { SEED_SITES } from "./lib/apiKeys";
import { SEED_PRICING } from "./lib/pricingSeed";

function siteFields(site: (typeof SEED_SITES)[number], now: number) {
  return {
    slug: site.slug,
    name: site.name,
    domain: site.domain,
    accentColor: site.accentColor,
    contactEmail: site.contactEmail,
    apiKeyHash: site.apiKeyHash,
    createdAt: now,
  };
}

export const seedSites = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("sites").first();
    if (existing) {
      return { seeded: false, message: "Sites already exist" };
    }

    const now = Date.now();
    for (const site of SEED_SITES) {
      await ctx.db.insert("sites", siteFields(site, now));
    }

    return { seeded: true, count: SEED_SITES.length };
  },
});

export const runSeed = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db.query("sites").first();
    if (existing) {
      return { seeded: false, message: "Sites already exist" };
    }

    const now = Date.now();
    for (const site of SEED_SITES) {
      await ctx.db.insert("sites", siteFields(site, now));
    }

    return { seeded: true, count: SEED_SITES.length };
  },
});

/**
 * Insert any SEED_SITES entries missing from the database, and backfill
 * contactEmail / name / domain / accentColor on existing rows (safe to re-run).
 */
export const syncSeedSites = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let added = 0;
    let updated = 0;

    for (const site of SEED_SITES) {
      const existing = await ctx.db
        .query("sites")
        .withIndex("by_slug", (q) => q.eq("slug", site.slug))
        .unique();

      if (!existing) {
        await ctx.db.insert("sites", siteFields(site, now));
        added += 1;
        continue;
      }

      const patch: {
        name?: string;
        domain?: string;
        accentColor?: string;
        contactEmail?: string;
        apiKeyHash?: string;
      } = {};

      if (existing.name !== site.name) patch.name = site.name;
      if (existing.domain !== site.domain) patch.domain = site.domain;
      if (existing.accentColor !== site.accentColor) {
        patch.accentColor = site.accentColor;
      }
      if (existing.contactEmail !== site.contactEmail) {
        patch.contactEmail = site.contactEmail;
      }
      // Lets a key rotation take effect by editing SEED_SITES and re-running.
      if (existing.apiKeyHash !== site.apiKeyHash) {
        patch.apiKeyHash = site.apiKeyHash;
      }

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, patch);
        updated += 1;
      }
    }

    return { added, updated, total: SEED_SITES.length };
  },
});

/**
 * Give any site without a pricing row the values it currently hardcodes.
 * Existing rows are left alone — once a price has been edited in the dashboard,
 * the database wins.
 */
export const syncSeedPricing = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let added = 0;
    let skipped = 0;
    const missingSites: string[] = [];

    for (const seed of SEED_PRICING) {
      const site = await ctx.db
        .query("sites")
        .withIndex("by_slug", (q) => q.eq("slug", seed.slug))
        .unique();

      if (!site) {
        missingSites.push(seed.slug);
        continue;
      }

      const existing = await ctx.db
        .query("sitePricing")
        .withIndex("by_site", (q) => q.eq("siteId", site._id))
        .unique();

      if (existing) {
        skipped += 1;
        continue;
      }

      await ctx.db.insert("sitePricing", {
        siteId: site._id,
        engine: seed.engine,
        currency: seed.currency,
        config: seed.config,
        version: 1,
        updatedAt: now,
      });
      added += 1;
    }

    return { added, skipped, missingSites, total: SEED_PRICING.length };
  },
});
