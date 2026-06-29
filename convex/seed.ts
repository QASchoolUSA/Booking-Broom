import { internalMutation, mutation } from "./_generated/server";
import { SEED_SITES } from "./lib/apiKeys";

export const seedSites = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("sites").first();
    if (existing) {
      return { seeded: false, message: "Sites already exist" };
    }

    const now = Date.now();
    for (const site of SEED_SITES) {
      await ctx.db.insert("sites", {
        slug: site.slug,
        name: site.name,
        domain: site.domain,
        accentColor: site.accentColor,
        apiKeyHash: site.apiKeyHash,
        createdAt: now,
      });
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
      await ctx.db.insert("sites", {
        slug: site.slug,
        name: site.name,
        domain: site.domain,
        accentColor: site.accentColor,
        apiKeyHash: site.apiKeyHash,
        createdAt: now,
      });
    }

    return { seeded: true, count: SEED_SITES.length };
  },
});
