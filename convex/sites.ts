import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";

function mapSite(doc: {
  _id: string;
  slug: string;
  name: string;
  domain: string;
  accentColor: string;
  contactEmail?: string;
  createdAt: number;
}) {
  return {
    id: doc._id,
    slug: doc.slug,
    name: doc.name,
    domain: doc.domain,
    accent_color: doc.accentColor,
    contact_email: doc.contactEmail ?? null,
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

export const getBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});
