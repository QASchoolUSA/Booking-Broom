import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { pricingConfig, pricingEngine } from "./lib/pricingConfigs";

export const bookingStatus = v.union(
  v.literal("new"),
  v.literal("confirmed"),
  v.literal("assigned"),
  v.literal("completed"),
  v.literal("cancelled")
);

/** Structured property details captured by the site booking wizards. */
export const bookingProperty = v.object({
  bedrooms: v.optional(v.number()),
  bathrooms: v.optional(v.number()),
  squareFeet: v.optional(v.number()),
  /** Human label when only a band is known, e.g. "1,000-1,500 sq ft". */
  sizeLabel: v.optional(v.string()),
  homeType: v.optional(v.string()),
  /** How dirty the home is, e.g. "Very dirty" — drives crew time. */
  condition: v.optional(v.string()),
  /** People living in the home. */
  occupants: v.optional(v.number()),
  /** When the home was last cleaned, as the site phrased it. */
  lastCleaned: v.optional(v.string()),
  /** Rooms or areas the customer asked the crew to skip. */
  excludedAreas: v.optional(v.array(v.string())),
});

/** Structured estimate captured by the site booking wizards. */
export const bookingQuote = v.object({
  estimate: v.optional(v.number()),
  estimateLow: v.optional(v.number()),
  estimateHigh: v.optional(v.number()),
  /**
   * Price of each ongoing visit when the estimate covers a one-off first clean,
   * e.g. Sanford quotes an initial deep clean plus a lower recurring rate.
   */
  recurringEstimate: v.optional(v.number()),
  currency: v.optional(v.string()),
  serviceLevel: v.optional(v.string()),
  frequency: v.optional(v.string()),
  addOns: v.optional(
    v.array(
      v.object({
        label: v.string(),
        price: v.optional(v.number()),
        quantity: v.optional(v.number()),
      })
    )
  ),
  paymentTerms: v.optional(v.string()),
  /**
   * Set when the site computed the estimate without ever showing it to the
   * customer, so it stays internal and is kept out of confirmation emails.
   */
  internal: v.optional(v.boolean()),
});

/** Where the lead came from, so marketing spend can be attributed. */
export const bookingAttribution = v.object({
  utmSource: v.optional(v.string()),
  utmMedium: v.optional(v.string()),
  utmCampaign: v.optional(v.string()),
  utmTerm: v.optional(v.string()),
  utmContent: v.optional(v.string()),
  gclid: v.optional(v.string()),
});

/** Whether the customer asked to book or was only price shopping. */
export const bookingIntent = v.union(v.literal("quote"), v.literal("book"));

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
    /** Override Bing Webmaster site URL when auto-match by domain fails. */
    bingPropertyUrl: v.optional(v.string()),
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
    /** Structured property details; absent on bookings sent before this existed. */
    property: v.optional(bookingProperty),
    /** Structured estimate; absent on bookings sent before this existed. */
    quote: v.optional(bookingQuote),
    /** Lead source; absent when the site does not track campaigns. */
    attribution: v.optional(bookingAttribution),
    /** Quote request vs booking request; absent when the site has one flow. */
    intent: v.optional(bookingIntent),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_site", ["siteId"])
    .index("by_created", ["createdAt"]),

  /**
   * Live pricing numbers for each cleaning site. The site owns the algorithm;
   * this row owns the values it plugs in. `engine` mirrors `config.kind` so the
   * engine can be read without narrowing the union.
   */
  sitePricing: defineTable({
    siteId: v.id("sites"),
    engine: pricingEngine,
    currency: v.string(),
    config: pricingConfig,
    /** Bumped on every save; sites use it as an ETag. */
    version: v.number(),
    updatedAt: v.number(),
  }).index("by_site", ["siteId"]),

  /** Previous pricing configs, newest version last, for review and rollback. */
  sitePricingHistory: defineTable({
    siteId: v.id("sites"),
    version: v.number(),
    engine: pricingEngine,
    currency: v.string(),
    config: pricingConfig,
    /** Human summary of what changed, e.g. "3 fields changed". */
    summary: v.string(),
    changedAt: v.number(),
  }).index("by_site_version", ["siteId", "version"]),

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

  /** Top search queries (keywords) from GSC for a site × period. */
  siteSearchQueries: defineTable({
    siteId: v.id("sites"),
    periodDays: v.union(
      v.literal(1),
      v.literal(2),
      v.literal(7),
      v.literal(28),
      v.literal(90)
    ),
    queries: v.array(
      v.object({
        query: v.string(),
        clicks: v.number(),
        impressions: v.number(),
        ctr: v.number(),
        position: v.number(),
      })
    ),
    syncedAt: v.number(),
  }).index("by_site_period", ["siteId", "periodDays"]),

  /**
   * Whether each app site matched a GSC or Bing Webmaster property on last sync.
   * Missing row ⇒ sync has not run yet (unconfigured).
   */
  siteSearchPropertyStatus: defineTable({
    siteId: v.id("sites"),
    source: v.union(v.literal("google"), v.literal("bing")),
    status: v.union(v.literal("matched"), v.literal("not_in_console")),
    propertyUrl: v.optional(v.string()),
    syncedAt: v.number(),
  }).index("by_site_source", ["siteId", "source"]),

  /** Singleton row tracking the last Bing Webmaster sync. */
  bingSyncState: defineTable({
    lastSyncAt: v.optional(v.number()),
    lastSyncError: v.optional(v.string()),
  }),

  /**
   * Latest Bing Webmaster traffic snapshot per site and period.
   * position is unused (always 0); CTR is derived from clicks/impressions.
   */
  siteBingSearchMetrics: defineTable({
    siteId: v.id("sites"),
    periodDays: v.union(
      v.literal(1),
      v.literal(2),
      v.literal(7),
      v.literal(28),
      v.literal(90)
    ),
    bingPropertyUrl: v.string(),
    clicks: v.number(),
    impressions: v.number(),
    ctr: v.number(),
    position: v.number(),
    startDate: v.string(),
    endDate: v.string(),
    syncedAt: v.number(),
  }).index("by_site_period", ["siteId", "periodDays"]),

  /** Daily Bing snapshots retained for ~7 days for delta comparisons. */
  siteBingSearchMetricsHistory: defineTable({
    siteId: v.id("sites"),
    periodDays: v.union(
      v.literal(1),
      v.literal(2),
      v.literal(7),
      v.literal(28),
      v.literal(90)
    ),
    snapshotDate: v.string(),
    bingPropertyUrl: v.string(),
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

  /** Top search queries (keywords) from Bing Webmaster for a site × period. */
  siteBingSearchQueries: defineTable({
    siteId: v.id("sites"),
    periodDays: v.union(
      v.literal(1),
      v.literal(2),
      v.literal(7),
      v.literal(28),
      v.literal(90)
    ),
    queries: v.array(
      v.object({
        query: v.string(),
        clicks: v.number(),
        impressions: v.number(),
        ctr: v.number(),
        position: v.number(),
      })
    ),
    syncedAt: v.number(),
  }).index("by_site_period", ["siteId", "periodDays"]),

  /** Latest Bing crawl issues snapshot per site. */
  siteBingCrawlIssues: defineTable({
    siteId: v.id("sites"),
    issueCount: v.number(),
    issues: v.array(
      v.object({
        url: v.string(),
        httpCode: v.number(),
        issues: v.number(),
        inLinks: v.number(),
      })
    ),
    syncedAt: v.number(),
  }).index("by_site", ["siteId"]),

  /** Latest homepage on-page SEO scan per site. */
  sitePageScans: defineTable({
    siteId: v.id("sites"),
    scannedUrl: v.string(),
    score: v.number(),
    passed: v.number(),
    total: v.number(),
    checks: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        pass: v.boolean(),
        detail: v.optional(v.string()),
      })
    ),
    error: v.optional(v.string()),
    scannedAt: v.number(),
  }).index("by_site", ["siteId"]),

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

  /** Per-site SpaceMail mailbox (IMAP/SMTP credentials encrypted at rest). */
  emailMailboxes: defineTable({
    siteId: v.id("sites"),
    email: v.string(),
    displayName: v.optional(v.string()),
    imapHost: v.string(),
    imapPort: v.number(),
    smtpHost: v.string(),
    smtpPort: v.number(),
    passwordCiphertext: v.string(),
    passwordIv: v.string(),
    uidValidity: v.optional(v.number()),
    lastUid: v.optional(v.number()),
    lastSyncAt: v.optional(v.number()),
    lastSyncError: v.optional(v.string()),
    /** Denormalized sum of thread unreadCounts — kept in sync by mutations. */
    unreadCount: v.optional(v.number()),
    status: v.union(
      v.literal("connected"),
      v.literal("error"),
      v.literal("disabled")
    ),
    createdAt: v.number(),
  })
    .index("by_site", ["siteId"])
    .index("by_email", ["email"])
    .index("by_status", ["status"]),

  /** Conversation thread within a mailbox. */
  emailThreads: defineTable({
    mailboxId: v.id("emailMailboxes"),
    threadKey: v.string(),
    subject: v.string(),
    participants: v.array(v.string()),
    lastMessageAt: v.number(),
    lastSnippet: v.string(),
    unreadCount: v.number(),
    messageCount: v.number(),
  })
    .index("by_mailbox_and_lastMessageAt", ["mailboxId", "lastMessageAt"])
    .index("by_mailbox_and_threadKey", ["mailboxId", "threadKey"]),

  /** Individual email messages synced from IMAP or sent via SMTP. */
  emailMessages: defineTable({
    mailboxId: v.id("emailMailboxes"),
    threadId: v.id("emailThreads"),
    uid: v.number(),
    messageId: v.string(),
    inReplyTo: v.optional(v.string()),
    references: v.optional(v.array(v.string())),
    direction: v.union(v.literal("in"), v.literal("out")),
    from: v.string(),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    subject: v.string(),
    textBody: v.optional(v.string()),
    htmlBody: v.optional(v.string()),
    sentAt: v.number(),
    seen: v.boolean(),
    answered: v.optional(v.boolean()),
    attachmentMeta: v.optional(
      v.array(
        v.object({
          filename: v.string(),
          size: v.number(),
          contentType: v.string(),
          storageId: v.optional(v.id("_storage")),
          skipped: v.optional(v.boolean()),
        })
      )
    ),
  })
    .index("by_mailbox_and_sentAt", ["mailboxId", "sentAt"])
    .index("by_mailbox_and_messageId", ["mailboxId", "messageId"])
    .index("by_mailbox_and_uid", ["mailboxId", "uid"])
    .index("by_thread_and_sentAt", ["threadId", "sentAt"]),

  /** Singleton round-robin cursor for cron IMAP sync. */
  emailSyncState: defineTable({
    lastSyncAt: v.optional(v.number()),
    lastSyncError: v.optional(v.string()),
    /** Index into sorted connected mailboxes for round-robin. */
    nextMailboxIndex: v.optional(v.number()),
  }),
});
