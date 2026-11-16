import {
  query,
  mutation,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  bookingProperty,
  bookingQuote,
  bookingAttribution,
  bookingIntent,
} from "./schema";
import type { Doc, Id } from "./_generated/dataModel";

function mapSite(doc: Doc<"sites">) {
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

function mapPartialLead(doc: Doc<"partialLeads">, site?: Doc<"sites">) {
  return {
    id: doc._id,
    site_id: doc.siteId,
    session_key: doc.sessionKey,
    customer_name: doc.customerName ?? null,
    email: doc.email ?? null,
    phone: doc.phone ?? null,
    address: doc.address ?? null,
    service_type: doc.serviceType ?? null,
    preferred_date: doc.preferredDate ?? null,
    preferred_time: doc.preferredTime ?? null,
    notes: doc.notes ?? null,
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
          add_ons:
            doc.quote.addOns?.map((addOn) => ({
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
    last_step: doc.lastStep ?? null,
    jev: doc.jev
      ? {
          hotness: doc.jev.hotness ?? null,
          hotness_confidence: doc.jev.hotnessConfidence ?? null,
          urgency: doc.jev.urgency ?? null,
          urgency_confidence: doc.jev.urgencyConfidence ?? null,
          is_spam_or_bot: doc.jev.isSpamOrBot ?? null,
          is_vendor_offer: doc.jev.isVendorOffer ?? null,
          job_fit: doc.jev.jobFit ?? null,
          value_band: doc.jev.valueBand ?? null,
          value_band_confidence: doc.jev.valueBandConfidence ?? null,
          recoverability: doc.jev.recoverability ?? null,
          recoverability_confidence: doc.jev.recoverabilityConfidence ?? null,
          best_channel: doc.jev.bestChannel ?? null,
          best_channel_confidence: doc.jev.bestChannelConfidence ?? null,
          is_junk: doc.jev.isJunk ?? null,
          is_hot: doc.jev.isHot ?? null,
          model: doc.jev.model ?? null,
          scored_at: new Date(doc.jev.scoredAt).toISOString(),
        }
      : null,
    converted_at: doc.convertedAt
      ? new Date(doc.convertedAt).toISOString()
      : null,
    converted_booking_id: doc.convertedBookingId ?? null,
    created_at: new Date(doc.createdAt).toISOString(),
    updated_at: new Date(doc.updatedAt).toISOString(),
    site: site ? mapSite(site) : undefined,
  };
}

function trimOrUndef(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t ? t.slice(0, 500) : undefined;
}

function looksLikeEmail(value: string | undefined): boolean {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function looksLikePhone(value: string | undefined): boolean {
  if (!value) return false;
  return value.replace(/\D/g, "").length >= 10;
}

/**
 * Public upsert from marketing sites. Contact-gated: email or phone required.
 * Schedules manager push + Telegram once on first insert (abandoned lead).
 */
export const upsertPublic = mutation({
  args: {
    siteSlug: v.string(),
    apiKeyHash: v.string(),
    sessionKey: v.string(),
    customerName: v.optional(v.string()),
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
    lastStep: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessionKey = args.sessionKey.trim().slice(0, 128);
    if (!sessionKey) {
      throw new Error("session_key is required");
    }

    const email = trimOrUndef(args.email);
    const phone = trimOrUndef(args.phone);
    if (!looksLikeEmail(email) && !looksLikePhone(phone)) {
      throw new Error("A valid email or phone is required");
    }

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

    const now = Date.now();
    const existing = await ctx.db
      .query("partialLeads")
      .withIndex("by_site_session", (q) =>
        q.eq("siteId", site._id).eq("sessionKey", sessionKey),
      )
      .unique();

    // Do not resurrect a converted lead; final submit already owns the booking.
    if (existing?.convertedAt) {
      return { id: existing._id, converted: true as const };
    }

    const fields = {
      customerName: trimOrUndef(args.customerName),
      email,
      phone,
      address: trimOrUndef(args.address),
      serviceType: trimOrUndef(args.serviceType),
      preferredDate: trimOrUndef(args.preferredDate),
      preferredTime: trimOrUndef(args.preferredTime),
      notes: trimOrUndef(args.notes),
      property: args.property,
      quote: args.quote,
      attribution: args.attribution,
      intent: args.intent,
      lastStep: trimOrUndef(args.lastStep)?.slice(0, 64),
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return { id: existing._id, converted: false as const };
    }

    const id = await ctx.db.insert("partialLeads", {
      siteId: site._id,
      sessionKey,
      ...fields,
      createdAt: now,
    });

    // Score with Jev (async) then notify — keeps marketing sites fast.
    await ctx.scheduler.runAfter(
      0,
      internal.jevActions.scorePartialLeadAndNotifyInternal,
      { leadId: id }
    );

    return { id, converted: false as const };
  },
});

/** Mark a soft lead converted after a real booking is created. */
export const markConvertedInternal = internalMutation({
  args: {
    siteId: v.id("sites"),
    sessionKey: v.string(),
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, args) => {
    const sessionKey = args.sessionKey.trim();
    if (!sessionKey) return;

    const existing = await ctx.db
      .query("partialLeads")
      .withIndex("by_site_session", (q) =>
        q.eq("siteId", args.siteId).eq("sessionKey", sessionKey),
      )
      .unique();

    if (!existing || existing.convertedAt) return;

    await ctx.db.patch(existing._id, {
      convertedAt: Date.now(),
      convertedBookingId: args.bookingId,
      updatedAt: Date.now(),
    });
  },
});

/** Dashboard list — non-converted by default, newest updates first. */
export const list = query({
  args: {
    siteSlug: v.optional(v.string()),
    includeConverted: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const limit = Math.min(Math.max(args.limit ?? 100, 1), 200);
    const includeConverted = args.includeConverted === true;

    let siteId: Id<"sites"> | undefined;
    if (args.siteSlug) {
      const site = await ctx.db
        .query("sites")
        .withIndex("by_slug", (q) => q.eq("slug", args.siteSlug!))
        .unique();
      if (!site) return [];
      siteId = site._id;
    }

    const rows = siteId
      ? await ctx.db
          .query("partialLeads")
          .withIndex("by_site_updated", (q) => q.eq("siteId", siteId!))
          .order("desc")
          .take(includeConverted ? limit : limit * 2)
      : await ctx.db
          .query("partialLeads")
          .withIndex("by_updated")
          .order("desc")
          .take(includeConverted ? limit : limit * 2);

    const filtered = includeConverted
      ? rows.slice(0, limit)
      : rows.filter((r) => r.convertedAt == null).slice(0, limit);

    const siteIds = [...new Set(filtered.map((r) => r.siteId))];
    const siteEntries = await Promise.all(
      siteIds.map(async (id) => {
        const site = await ctx.db.get(id);
        return site ? ([id, site] as const) : null;
      }),
    );
    const siteMap = new Map(
      siteEntries.filter((e): e is NonNullable<typeof e> => e != null),
    );

    return filtered.map((lead) =>
      mapPartialLead(lead, siteMap.get(lead.siteId)),
    );
  },
});

export const get = query({
  args: { leadId: v.id("partialLeads") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const lead = await ctx.db.get(args.leadId);
    if (!lead) return null;
    const site = await ctx.db.get(lead.siteId);
    return mapPartialLead(lead, site ?? undefined);
  },
});

/**
 * Abandoned leads worth recovering — non-converted, has contact, not Jev junk.
 * Sorted by recoverability × quote estimate (unscored last).
 */
export const listRecovery = query({
  args: {
    siteSlug: v.optional(v.string()),
    limit: v.optional(v.number()),
    /** When false, include unscored leads (default true hides only decisive junk). */
    hideJunk: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const hideJunk = args.hideJunk !== false;

    let siteId: Id<"sites"> | undefined;
    if (args.siteSlug) {
      const site = await ctx.db
        .query("sites")
        .withIndex("by_slug", (q) => q.eq("slug", args.siteSlug!))
        .unique();
      if (!site) return [];
      siteId = site._id;
    }

    const rows = siteId
      ? await ctx.db
          .query("partialLeads")
          .withIndex("by_site_updated", (q) => q.eq("siteId", siteId!))
          .order("desc")
          .take(200)
      : await ctx.db
          .query("partialLeads")
          .withIndex("by_updated")
          .order("desc")
          .take(200);

    const candidates = rows.filter((r) => {
      if (r.convertedAt != null) return false;
      const hasContact =
        Boolean(r.email?.trim()) || Boolean(r.phone?.trim());
      if (!hasContact) return false;
      if (hideJunk && r.jev?.isJunk === true) return false;
      if (r.jev?.bestChannel === "none" && (r.jev.bestChannelConfidence ?? 0) >= 0.8) {
        return false;
      }
      return true;
    });

    const ranked = candidates
      .map((r) => {
        const recover = r.jev?.recoverability ?? 0.35;
        const estimate =
          r.quote?.estimate ??
          r.quote?.estimateHigh ??
          r.quote?.estimateLow ??
          0;
        const rank = recover * (1 + Math.min(estimate, 2000) / 2000);
        return { r, rank };
      })
      .sort((a, b) => b.rank - a.rank)
      .slice(0, limit)
      .map(({ r }) => r);

    const siteIds = [...new Set(ranked.map((r) => r.siteId))];
    const siteEntries = await Promise.all(
      siteIds.map(async (id) => {
        const site = await ctx.db.get(id);
        return site ? ([id, site] as const) : null;
      }),
    );
    const siteMap = new Map(
      siteEntries.filter((e): e is NonNullable<typeof e> => e != null),
    );

    return ranked.map((lead) =>
      mapPartialLead(lead, siteMap.get(lead.siteId)),
    );
  },
});

/** Queue Jev scoring for unscored recovery candidates (manager-triggered). */
export const enqueueRecoveryScoring = mutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const limit = Math.min(Math.max(args.limit ?? 20, 1), 40);
    const rows = await ctx.db
      .query("partialLeads")
      .withIndex("by_updated")
      .order("desc")
      .take(120);

    let queued = 0;
    for (const r of rows) {
      if (queued >= limit) break;
      if (r.convertedAt != null || r.jev) continue;
      const hasContact =
        Boolean(r.email?.trim()) || Boolean(r.phone?.trim());
      if (!hasContact) continue;
      await ctx.scheduler.runAfter(
        0,
        internal.jevActions.scorePartialLeadInternal,
        { leadId: r._id },
      );
      queued += 1;
    }
    return { queued };
  },
});

/** Claim abandoned-lead push once (idempotent). */
export const claimPushNotifyInternal = internalMutation({
  args: { leadId: v.id("partialLeads") },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) return { claimed: false as const, reason: "missing" as const };
    if (lead.pushNotifiedAt != null) {
      return { claimed: false as const, reason: "already" as const };
    }
    await ctx.db.patch(args.leadId, { pushNotifiedAt: Date.now() });
    return { claimed: true as const, reason: "ok" as const };
  },
});

/** Claim abandoned-lead Telegram once (idempotent). */
export const claimTelegramNotifyInternal = internalMutation({
  args: { leadId: v.id("partialLeads") },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) return { claimed: false as const, reason: "missing" as const };
    if (lead.telegramNotifiedAt != null) {
      return { claimed: false as const, reason: "already" as const };
    }
    await ctx.db.patch(args.leadId, { telegramNotifiedAt: Date.now() });
    return { claimed: true as const, reason: "ok" as const };
  },
});
