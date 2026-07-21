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
    /** Public contact phone scraped from the cleaning site HTML. */
    phoneNumber: v.optional(v.string()),
    /** Manual ops checklist: booking inbox / SMTP for this site is set up. */
    emailConfigured: v.optional(v.boolean()),
    /** Override GSC property URL when auto-match by domain fails. */
    gscPropertyUrl: v.optional(v.string()),
    /** Full URL override for PageSpeed Insights when https://{domain} is wrong. */
    performanceUrl: v.optional(v.string()),
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

  /** Single Google Search Console OAuth connection for the manager account. */
  gscConnections: defineTable({
    googleEmail: v.string(),
    refreshToken: v.string(),
    accessToken: v.string(),
    accessTokenExpiresAt: v.number(),
    connectedAt: v.number(),
    lastSyncAt: v.optional(v.number()),
    lastSyncError: v.optional(v.string()),
  }),

  /** Short-lived OAuth CSRF state for the GSC connect flow. */
  gscOauthStates: defineTable({
    state: v.string(),
    returnOrigin: v.string(),
    createdAt: v.number(),
  }).index("by_state", ["state"]),

  /**
   * Latest Search Console snapshot per site and period.
   * periodDays: 1 = today, 2 = yesterday, 7/28/90 = rolling windows.
   */
  siteSearchMetrics: defineTable({
    siteId: v.id("sites"),
    periodDays: v.union(
      v.literal(1),
      v.literal(2),
      v.literal(7),
      v.literal(28),
      v.literal(90)
    ),
    gscPropertyUrl: v.string(),
    clicks: v.number(),
    impressions: v.number(),
    ctr: v.number(),
    position: v.number(),
    startDate: v.string(),
    endDate: v.string(),
    syncedAt: v.number(),
  }).index("by_site_period", ["siteId", "periodDays"]),

  /** Daily GSC snapshots retained for ~7 days for delta comparisons. */
  siteSearchMetricsHistory: defineTable({
    siteId: v.id("sites"),
    periodDays: v.union(
      v.literal(1),
      v.literal(2),
      v.literal(7),
      v.literal(28),
      v.literal(90)
    ),
    /** UTC calendar day of the sync that wrote this row (YYYY-MM-DD). */
    snapshotDate: v.string(),
    gscPropertyUrl: v.string(),
    clicks: v.number(),
    impressions: v.number(),
    ctr: v.number(),
    position: v.number(),
    startDate: v.string(),
    endDate: v.string(),
    syncedAt: v.number(),
  })
    .index("by_site_period_date", ["siteId", "periodDays", "snapshotDate"])
    .index("by_synced_at", ["syncedAt"]),

  /** Singleton row tracking the last PageSpeed Insights sync. */
  pagespeedSyncState: defineTable({
    lastSyncAt: v.optional(v.number()),
    lastSyncError: v.optional(v.string()),
  }),

  /** Latest PageSpeed Insights snapshot per site and strategy. */
  sitePerformanceMetrics: defineTable({
    siteId: v.id("sites"),
    strategy: v.union(v.literal("mobile"), v.literal("desktop")),
    url: v.string(),
    performanceScore: v.optional(v.number()),
    accessibilityScore: v.optional(v.number()),
    bestPracticesScore: v.optional(v.number()),
    seoScore: v.optional(v.number()),
    /** Lighthouse Agentic Browsing category (0–100). Display mode is fractional. */
    agenticBrowsingScore: v.optional(v.number()),
    agenticBrowsingPassed: v.optional(v.number()),
    agenticBrowsingTotal: v.optional(v.number()),
    lcpMs: v.optional(v.number()),
    cls: v.optional(v.number()),
    inpMs: v.optional(v.number()),
    fcpMs: v.optional(v.number()),
    /** CrUX field data overall category when available: FAST | AVERAGE | SLOW */
    overallCategory: v.optional(v.string()),
    error: v.optional(v.string()),
    syncedAt: v.number(),
  }).index("by_site_strategy", ["siteId", "strategy"]),

  /** Singleton row tracking the last site uptime / HTML health check sync. */
  siteHealthSyncState: defineTable({
    lastSyncAt: v.optional(v.number()),
    lastSyncError: v.optional(v.string()),
  }),

  /** Latest HTTP health check per cleaning site. */
  siteHealthStatus: defineTable({
    siteId: v.id("sites"),
    status: v.union(v.literal("online"), v.literal("offline")),
    checkedUrl: v.string(),
    httpStatus: v.optional(v.number()),
    error: v.optional(v.string()),
    checkedAt: v.number(),
  }).index("by_site", ["siteId"]),

  /** Voip.ms DID numbers (one per business line / sub-account). */
  smsDids: defineTable({
    did: v.string(),
    description: v.string(),
    subAccount: v.optional(v.string()),
    smsEnabled: v.boolean(),
    siteId: v.optional(v.id("sites")),
    lastSyncedAt: v.number(),
  })
    .index("by_did", ["did"])
    .index("by_sub_account", ["subAccount"]),

  /** Inbound/outbound SMS and MMS synced from Voip.ms or received via webhook. */
  smsMessages: defineTable({
    voipmsId: v.string(),
    did: v.string(),
    contact: v.string(),
    direction: v.union(v.literal("in"), v.literal("out")),
    type: v.union(v.literal("sms"), v.literal("mms")),
    body: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
    sentAt: v.number(),
    status: v.optional(v.string()),
  })
    .index("by_did_and_sentAt", ["did", "sentAt"])
    .index("by_did_contact_sentAt", ["did", "contact", "sentAt"])
    .index("by_voipms_id", ["voipmsId"])
    .index("by_sentAt", ["sentAt"]),

  /** Singleton row tracking the last Voip.ms SMS sync. */
  smsSyncState: defineTable({
    lastSyncAt: v.optional(v.number()),
    lastSyncError: v.optional(v.string()),
    lastDidSyncAt: v.optional(v.number()),
  }),

  /**
   * CRM-style label/note for a conversation (your DID + customer number).
   */
  smsConversationMeta: defineTable({
    did: v.string(),
    contact: v.string(),
    label: v.optional(v.string()),
    note: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_did_contact", ["did", "contact"]),
});
