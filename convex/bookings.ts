import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import {
  bookingStatus,
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
    hosting_provider: doc.hostingProvider ?? null,
    hosting_account_email: doc.hostingAccountEmail ?? null,
    phone_number: doc.phoneNumber ?? null,
    email_configured: doc.emailConfigured ?? false,
    gsc_property_url: doc.gscPropertyUrl ?? null,
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
    created_at: new Date(doc.createdAt).toISOString(),
    updated_at: new Date(doc.updatedAt).toISOString(),
    site: site ? mapSite(site) : undefined,
  };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
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
      .collect();

    return bookings.map((booking) =>
      mapBooking(booking, siteMap.get(booking.siteId))
    );
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

export const remove = mutation({
  args: {
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found");

    await ctx.db.delete(args.bookingId);
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
      createdAt: now,
      updatedAt: now,
    });

    return { id };
  },
});
