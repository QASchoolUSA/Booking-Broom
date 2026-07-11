import { internalMutation, mutation } from "./_generated/server";
import { SEED_SITES } from "./lib/apiKeys";

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

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, patch);
        updated += 1;
      }
    }

    return { added, updated, total: SEED_SITES.length };
  },
});
