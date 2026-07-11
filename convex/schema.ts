import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export const bookingStatus = v.union(
  v.literal("new"),
  v.literal("confirmed"),
  v.literal("assigned"),
  v.literal("completed"),
  v.literal("cancelled")
);

export default defineSchema({
  ...authTables,

  sites: defineTable({
    slug: v.string(),
    name: v.string(),
    domain: v.string(),
    accentColor: v.string(),
    /** Site-specific inbox used for booking admin alerts and From/Reply-To. */
    contactEmail: v.optional(v.string()),
    /** Where the cleaning site is hosted (for ops login reminders). */
    hostingProvider: v.optional(
      v.union(v.literal("vercel"), v.literal("cloudflare"))
    ),
    /** Email used to sign in to the hosting account. */
    hostingAccountEmail: v.optional(v.string()),
    apiKeyHash: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_slug", ["slug"]),

  bookings: defineTable({
    siteId: v.id("sites"),
    status: bookingStatus,
    customerName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    serviceType: v.string(),
    preferredDate: v.optional(v.string()),
    preferredTime: v.optional(v.string()),
    notes: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_site", ["siteId"])
    .index("by_created", ["createdAt"]),
});
