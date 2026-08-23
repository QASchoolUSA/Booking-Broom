import { query, mutation, internalQuery, internalMutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  bookingStatus,
  bookingProperty,
  bookingQuote,
  bookingAttribution,
  bookingIntent,
} from "./schema";
import type { Doc, Id } from "./_generated/dataModel";
import {
  DEFAULT_JOB_DURATION_MS,
  DEFAULT_TIMEZONE,
} from "./lib/calendarTime";

/** Map Convex camelCase property → snake_case email action args. */
function toEmailProperty(property: Doc<"bookings">["property"]) {
  if (!property) return undefined;
  return {
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    square_feet: property.squareFeet,
    size_label: property.sizeLabel,
    home_type: property.homeType,
    condition: property.condition,
    occupants: property.occupants,
    last_cleaned: property.lastCleaned,
    excluded_areas: property.excludedAreas,
  };
}

/** Map Convex camelCase quote → snake_case email action args. */
function toEmailQuote(quote: Doc<"bookings">["quote"]) {
  if (!quote) return undefined;
  return {
    estimate: quote.estimate,
    estimate_low: quote.estimateLow,
    estimate_high: quote.estimateHigh,
    recurring_estimate: quote.recurringEstimate,
    currency: quote.currency,
    service_level: quote.serviceLevel,
    frequency: quote.frequency,
    add_ons: quote.addOns,
    payment_terms: quote.paymentTerms,
    internal: quote.internal,
  };
}

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
    performance_url: doc.performanceUrl ?? null,
    created_at: new Date(doc.createdAt).toISOString(),
  };
}

function mapBooking(doc: Doc<"bookings">, site?: Doc<"sites">) {
  return {
    id: doc._id,
    site_id: doc.siteId,
    status: doc.status,
    customer_name: doc.customerName,
    email: doc.email ?? null,
    phone: doc.phone ?? null,
    address: doc.address ?? null,
    service_type: doc.serviceType,
    preferred_date: doc.preferredDate ?? null,
    preferred_time: doc.preferredTime ?? null,
    notes: doc.notes ?? null,
    internal_notes: doc.internalNotes ?? null,
    property: doc.property
      ? {
          bedrooms: doc.property.bedrooms ?? null,
          bathrooms: doc.property.bathrooms ?? null,
          square_feet: doc.property.squareFeet ?? null,
          size_label: doc.property.sizeLabel ?? null,
          home_type: doc.property.homeType ?? null,
          condition: doc.property.condition ?? null,
          occupants: doc.property.occupants ?? null,
          last_cleaned: doc.property.lastCleaned ?? null,
          excluded_areas: doc.property.excludedAreas ?? null,
        }
      : null,
    quote: doc.quote
      ? {
          estimate: doc.quote.estimate ?? null,
          estimate_low: doc.quote.estimateLow ?? null,
          estimate_high: doc.quote.estimateHigh ?? null,
          recurring_estimate: doc.quote.recurringEstimate ?? null,
          currency: doc.quote.currency ?? "USD",
          service_level: doc.quote.serviceLevel ?? null,
          frequency: doc.quote.frequency ?? null,
          add_ons: doc.quote.addOns?.map((addOn) => ({
            label: addOn.label,
            price: addOn.price ?? null,
            quantity: addOn.quantity ?? null,
          })) ?? null,
          payment_terms: doc.quote.paymentTerms ?? null,
          internal: doc.quote.internal ?? false,
        }
      : null,
    attribution: doc.attribution
      ? {
          utm_source: doc.attribution.utmSource ?? null,
          utm_medium: doc.attribution.utmMedium ?? null,
          utm_campaign: doc.attribution.utmCampaign ?? null,
          utm_term: doc.attribution.utmTerm ?? null,
          utm_content: doc.attribution.utmContent ?? null,
          gclid: doc.attribution.gclid ?? null,
        }
      : null,
    intent: doc.intent ?? null,
    scheduled_start_at: doc.scheduledStartAt
      ? new Date(doc.scheduledStartAt).toISOString()
      : null,
    scheduled_end_at: doc.scheduledEndAt
      ? new Date(doc.scheduledEndAt).toISOString()
      : null,
    scheduled_start_at_ms: doc.scheduledStartAt ?? null,
    scheduled_end_at_ms: doc.scheduledEndAt ?? null,
    timezone: doc.timezone ?? null,
    archived_at: doc.archivedAt
      ? new Date(doc.archivedAt).toISOString()
      : null,
    created_at: new Date(doc.createdAt).toISOString(),
    updated_at: new Date(doc.updatedAt).toISOString(),
    site: site ? mapSite(site) : undefined,
  };
}

export const list = query({
  args: {
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const sites = await ctx.db.query("sites").collect();
    const siteMap = new Map<Id<"sites">, Doc<"sites">>(
      sites.map((site) => [site._id, site])
    );

    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_created")
      .order("desc")
      .take(400);

    const includeArchived = args.includeArchived === true;
    const filtered = includeArchived
      ? bookings.filter((b) => b.archivedAt != null)
      : bookings.filter((b) => b.archivedAt == null);

    return filtered
      .slice(0, 200)
      .map((booking) => mapBooking(booking, siteMap.get(booking.siteId)));
  },
});

export const get = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) return null;
    const site = await ctx.db.get(booking.siteId);
    return mapBooking(booking, site ?? undefined);
  },
});

/**
 * Read-back for `scripts/check-booking-payload.mjs`, which has no dashboard
 * session. Internal, so only the Convex CLI and other server functions can
 * call it.
 */
export const latestForSite = internalQuery({
  args: { slug: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!site) return [];

    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .collect();

    return bookings
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, args.limit ?? 20)
      .map((booking) => mapBooking(booking, site));
  },
});

export const updateStatus = mutation({
  args: {
    bookingId: v.id("bookings"),
    status: bookingStatus,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    await ctx.db.patch(args.bookingId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const updateInternalNotes = mutation({
  args: {
    bookingId: v.id("bookings"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    await ctx.db.patch(args.bookingId, {
      internalNotes: args.notes,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Set or clear a confirmed job slot. Optionally mark status confirmed and
 * create preset manager alerts (minutes before start).
 */
export const schedule = mutation({
  args: {
    bookingId: v.id("bookings"),
    scheduledStartAt: v.union(v.number(), v.null()),
    scheduledEndAt: v.optional(v.union(v.number(), v.null())),
    timezone: v.optional(v.string()),
    confirm: v.optional(v.boolean()),
    /** Offset minutes before start for new alerts (e.g. [1440, 60]). */
    alertOffsetsMinutes: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found");

    const now = Date.now();
    const timezone = (args.timezone?.trim() || DEFAULT_TIMEZONE).trim();

    if (args.scheduledStartAt === null) {
      await ctx.db.patch(args.bookingId, {
        scheduledStartAt: undefined,
        scheduledEndAt: undefined,
        timezone: undefined,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.reminders.cancelRelativeForBookingInternal,
        { bookingId: args.bookingId }
      );
      return { id: args.bookingId };
    }

    const startAt = args.scheduledStartAt;
    if (!Number.isFinite(startAt)) throw new Error("Invalid start time");

    let endAt =
      args.scheduledEndAt === null
        ? undefined
        : args.scheduledEndAt ?? startAt + DEFAULT_JOB_DURATION_MS;
    if (endAt == null) endAt = startAt + DEFAULT_JOB_DURATION_MS;
    if (endAt <= startAt) {
      endAt = startAt + DEFAULT_JOB_DURATION_MS;
    }

    const patch: Partial<Doc<"bookings">> = {
      scheduledStartAt: startAt,
      scheduledEndAt: endAt,
      timezone,
      updatedAt: now,
    };
    if (args.confirm && booking.status === "new") {
      patch.status = "confirmed";
    }

    await ctx.db.patch(args.bookingId, patch);

    await ctx.scheduler.runAfter(
      0,
      internal.reminders.rescheduleRelativeForBookingInternal,
      { bookingId: args.bookingId, scheduledStartAt: startAt }
    );

    const offsets = args.alertOffsetsMinutes ?? [];
    for (const offset of offsets) {
      if (!Number.isFinite(offset) || offset < 0) continue;
      const dueAt = startAt - offset * 60 * 1000;
      const title =
        offset === 0
          ? `Job now · ${booking.customerName}`
          : offset < 60
            ? `Job in ${offset}m · ${booking.customerName}`
            : offset < 1440
              ? `Job in ${Math.round(offset / 60)}h · ${booking.customerName}`
              : `Job tomorrow · ${booking.customerName}`;

      const reminderId = await ctx.db.insert("reminders", {
        title,
        notes: booking.serviceType,
        dueAt,
        bookingId: args.bookingId,
        offsetMinutes: offset,
        status: "pending",
        createdBy: identity.subject,
        createdAt: now,
        updatedAt: now,
      });

      const scheduledFunctionId =
        dueAt <= now
          ? await ctx.scheduler.runAfter(
              0,
              internal.reminders.dispatchInternal,
              { reminderId }
            )
          : await ctx.scheduler.runAt(
              dueAt,
              internal.reminders.dispatchInternal,
              { reminderId }
            );
      await ctx.db.patch(reminderId, { scheduledFunctionId });
    }

    return { id: args.bookingId };
  },
});

export const remove = mutation({
  args: {
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found");

    await ctx.scheduler.runAfter(
      0,
      internal.reminders.cancelForBookingInternal,
      { bookingId: args.bookingId }
    );
    await ctx.db.delete(args.bookingId);
  },
});

export const archive = mutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found");
    const now = Date.now();
    await ctx.db.patch(args.bookingId, {
      archivedAt: now,
      updatedAt: now,
    });
  },
});

export const unarchive = mutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found");
    await ctx.db.patch(args.bookingId, {
      archivedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const createPublic = mutation({
  args: {
    siteSlug: v.string(),
    apiKeyHash: v.string(),
    customerName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    serviceType: v.optional(v.string()),
    preferredDate: v.optional(v.string()),
    preferredTime: v.optional(v.string()),
    notes: v.optional(v.string()),
    property: v.optional(bookingProperty),
    quote: v.optional(bookingQuote),
    attribution: v.optional(bookingAttribution),
    intent: v.optional(bookingIntent),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", args.siteSlug))
      .unique();

    if (!site) {
      throw new Error("Invalid site");
    }

    if (site.apiKeyHash !== args.apiKeyHash) {
      throw new Error("Invalid API key");
    }

    const idempotencyKey = args.idempotencyKey?.trim() || undefined;
    if (idempotencyKey) {
      const existing = await ctx.db
        .query("bookings")
        .withIndex("by_site_idempotency", (q) =>
          q.eq("siteId", site._id).eq("idempotencyKey", idempotencyKey),
        )
        .unique();
      if (existing) {
        return { id: existing._id };
      }
    }

    const now = Date.now();
    const id = await ctx.db.insert("bookings", {
      siteId: site._id,
      status: "new",
      customerName: args.customerName,
      email: args.email,
      phone: args.phone,
      address: args.address,
      serviceType: args.serviceType ?? "Standard Clean",
      preferredDate: args.preferredDate,
      preferredTime: args.preferredTime,
      notes: args.notes,
      property: args.property,
      quote: args.quote,
      attribution: args.attribution,
      intent: args.intent,
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.pushActions.notifyNewBookingInternal,
      {
        siteSlug: args.siteSlug,
        customerName: args.customerName,
        serviceType: args.serviceType,
        bookingId: id,
      }
    );

    await ctx.scheduler.runAfter(
      0,
      internal.emailActions.sendBookingEmailsInternal,
      {
        site_slug: args.siteSlug,
        customer_name: args.customerName,
        email: args.email,
        phone: args.phone,
        address: args.address,
        service_type: args.serviceType,
        preferred_date: args.preferredDate,
        preferred_time: args.preferredTime,
        notes: args.notes,
        property: toEmailProperty(args.property),
        quote: toEmailQuote(args.quote),
        bookingId: id,
      }
    );

    await ctx.scheduler.runAfter(
      0,
      internal.voipmsActions.sendBookingSmsInternal,
      {
        site_slug: args.siteSlug,
        customer_name: args.customerName,
        phone: args.phone,
        service_type: args.serviceType,
        preferred_date: args.preferredDate,
        bookingId: id,
      }
    );

    // Telegram is best-effort and async — never on the marketing-site HTTP path.
    await ctx.scheduler.runAfter(
      0,
      internal.telegramActions.notifyNewBookingInternal,
      {
        siteSlug: args.siteSlug,
        customerName: args.customerName,
        email: args.email,
        phone: args.phone,
        address: args.address,
        serviceType: args.serviceType,
        preferredDate: args.preferredDate,
        preferredTime: args.preferredTime,
        notes: args.notes,
        intent: args.intent,
        quoteEstimate: args.quote?.estimate,
        quoteCurrency: args.quote?.currency,
        quoteFrequency: args.quote?.frequency,
        bookingId: id,
      }
    );

    return { id };
  },
});

type ClaimResult =
  | { claimed: true }
  | { claimed: false; reason: "missing" | "already" };

async function claimNotifyField(
  ctx: MutationCtx,
  bookingId: Id<"bookings">,
  field:
    | "pushNotifiedAt"
    | "smsNotifiedAt"
    | "emailNotifiedAt"
    | "telegramNotifiedAt"
): Promise<ClaimResult> {
  const booking = await ctx.db.get(bookingId);
  if (!booking) return { claimed: false, reason: "missing" };
  if (booking[field] != null) {
    return { claimed: false, reason: "already" };
  }
  const now = Date.now();
  await ctx.db.patch(bookingId, {
    [field]: now,
    updatedAt: now,
  });
  return { claimed: true };
}

/** Claim push notify for a booking once; retries / dual callers no-op. */
export const claimPushNotifyInternal = internalMutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    return await claimNotifyField(ctx, args.bookingId, "pushNotifiedAt");
  },
});

/** Claim booking SMS once; retries / dual callers no-op. */
export const claimSmsNotifyInternal = internalMutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    return await claimNotifyField(ctx, args.bookingId, "smsNotifiedAt");
  },
});

/** Claim booking emails once; retries / dual callers no-op. */
export const claimEmailNotifyInternal = internalMutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    return await claimNotifyField(ctx, args.bookingId, "emailNotifiedAt");
  },
});

/** Claim Telegram manager alert once; retries / dual callers no-op. */
export const claimTelegramNotifyInternal = internalMutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    return await claimNotifyField(ctx, args.bookingId, "telegramNotifiedAt");
  },
});

/** Marker written into notes by `scripts/test-all-site-bookings.mjs`. */
export const AUTOMATION_PROBE_NOTES_MARKER = "AUTOMATION TEST BOOKING";

/**
 * Delete rows created by `pnpm test:bookings-all` only.
 * Matches notes marker and/or probe idempotency keys (`probe-<runId>-…`).
 * Ordinary bookings never use that key prefix or marker.
 */
export const cleanupAutomationProbeBookings = internalMutation({
  args: {
    runId: v.optional(v.string()),
    /** Only consider bookings newer than now - maxAgeMs (default 48h). */
    maxAgeMs: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const maxAgeMs = args.maxAgeMs ?? 48 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAgeMs;
    const runId = args.runId?.trim() || undefined;
    const dryRun = args.dryRun === true;
    const idemPrefix = runId ? `probe-${runId}-` : "probe-";

    const recent = await ctx.db
      .query("bookings")
      .withIndex("by_created", (q) => q.gte("createdAt", cutoff))
      .collect();

    const matched = recent.filter((booking) => {
      const notes = booking.notes ?? "";
      const key = booking.idempotencyKey ?? "";
      const notesHit =
        notes.includes(AUTOMATION_PROBE_NOTES_MARKER) &&
        (!runId || notes.includes(`Run id: ${runId}`));
      const keyHit = key.startsWith(idemPrefix);
      return notesHit || keyHit;
    });

    const deletedIds: Id<"bookings">[] = [];
    if (!dryRun) {
      for (const booking of matched) {
        await ctx.scheduler.runAfter(
          0,
          internal.reminders.cancelForBookingInternal,
          { bookingId: booking._id },
        );
        await ctx.db.delete(booking._id);
        deletedIds.push(booking._id);
      }
    }

    return {
      dryRun,
      runId: runId ?? null,
      matched: matched.length,
      deleted: dryRun ? 0 : deletedIds.length,
      ids: (dryRun ? matched.map((b) => b._id) : deletedIds) as string[],
    };
  },
});
