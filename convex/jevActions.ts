import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { leadJevScore, emailJevBucket } from "./schema";
import {
  asChoice,
  asNoul,
  asScore,
  choice,
  decide,
  isDecisiveChoice,
  isDecisiveScore,
  isDecisiveYes,
  jevConfigured,
  noul,
  score,
} from "./lib/jev";

type LeadJev = Doc<"bookings">["jev"];

const URGENCY = {
  today: "Needs attention today — same-day or next-day preferred date, or urgent language",
  this_week: "Wants service within about a week",
  flexible: "Timing is flexible or far out",
  unknown: "Not enough signal to judge timing",
} as const;

const VALUE_BAND = {
  small: "Small job — studio/1bed, light clean, low estimate",
  standard: "Typical residential or small office clean",
  large: "Large home, deep/move-out, commercial, or high estimate",
  unknown: "Not enough property or quote detail",
} as const;

const BEST_CHANNEL = {
  call: "A phone call is the best next step",
  sms: "A short SMS is the best next step",
  email: "Email is the best next step",
  none: "Do not chase — incomplete, junk, or already converted signal",
} as const;

const EMAIL_BUCKET = {
  reply_today: "Needs a human reply today — customer, booking, or time-sensitive",
  booking_related: "About a cleaning booking, quote, or customer job but not urgent",
  vendor: "Someone selling services, SEO, staffing, or software to the business",
  newsletter: "Marketing newsletter, promo blast, or automated digest",
  spam: "Spam, phishing, scam, or bulk junk",
  noise: "Receipts, system mail, or low-value noise that is not spam",
  unknown: "Cannot classify confidently",
} as const;

function leadQuestions(includeRecovery: boolean) {
  const q: Record<string, ReturnType<typeof choice> | ReturnType<typeof score> | ReturnType<typeof noul>> = {
    hotness: score(
      "How likely is this lead to become a booked cleaning job if a manager contacts them soon?",
      [
        "Almost no chance — incomplete, junk, or clearly not a customer",
        "Low chance — vague interest or weak contact details",
        "Reasonable chance — real customer signal with contact info",
        "High chance — clear intent, contact details, and timing or property detail",
      ]
    ),
    urgency: choice(
      "How soon does this lead need manager attention for a cleaning job?",
      URGENCY
    ),
    is_spam_or_bot: noul(
      "Is this lead fake spam, a bot form-fill, SEO spam, gibberish, or a link farm — not a real person requesting cleaning?",
      "Yes — spam, bot, or fake inquiry",
      "No — looks like a real person or at least a plausible human inquiry"
    ),
    is_vendor_offer: noul(
      "Is the submitter pitching THEIR own services to the cleaning business (SEO, leads, staffing, software, partnerships) rather than requesting a cleaning?",
      "Yes — vendor / sales pitch to the business, often in notes",
      "No — they want cleaning or a quote as a customer"
    ),
    job_fit: noul(
      "Does this look like a plausible residential or commercial cleaning request for a local cleaning company?",
      "Yes — plausible cleaning job or quote request",
      "No — wrong intent, incomplete nonsense, or unrelated"
    ),
    value_band: choice(
      "Relative job size for a local cleaning company, from property and quote fields?",
      VALUE_BAND
    ),
  };

  if (includeRecovery) {
    q.recoverability = score(
      "For this abandoned incomplete form: how worth is a call or SMS recovery attempt right now?",
      [
        "Not worth chasing — junk, no contact, or hopeless",
        "Low priority — weak signal",
        "Worth a quick SMS or email",
        "High priority — strong contact + intent; call or SMS soon",
      ]
    );
    q.best_channel = choice(
      "Best channel to recover this abandoned lead?",
      BEST_CHANNEL
    );
  }

  return q;
}

function buildLeadState(doc: {
  customerName?: string;
  email?: string;
  phone?: string;
  address?: string;
  serviceType?: string;
  preferredDate?: string;
  preferredTime?: string;
  notes?: string;
  intent?: string;
  property?: Doc<"bookings">["property"];
  quote?: Doc<"bookings">["quote"];
  attribution?: Doc<"bookings">["attribution"];
  lastStep?: string;
  kind: "booking" | "partial";
}) {
  return {
    kind: doc.kind,
    customer_name: doc.customerName ?? null,
    has_email: Boolean(doc.email?.trim()),
    has_phone: Boolean(doc.phone?.trim()),
    address: doc.address?.trim()?.slice(0, 200) ?? null,
    service_type: doc.serviceType ?? null,
    preferred_date: doc.preferredDate ?? null,
    preferred_time: doc.preferredTime ?? null,
    notes: doc.notes?.trim()?.slice(0, 1500) ?? null,
    intent: doc.intent ?? null,
    last_step: doc.lastStep ?? null,
    property: doc.property
      ? {
          bedrooms: doc.property.bedrooms ?? null,
          bathrooms: doc.property.bathrooms ?? null,
          square_feet: doc.property.squareFeet ?? null,
          size_label: doc.property.sizeLabel ?? null,
          home_type: doc.property.homeType ?? null,
          condition: doc.property.condition ?? null,
        }
      : null,
    quote: doc.quote
      ? {
          estimate: doc.quote.estimate ?? null,
          estimate_low: doc.quote.estimateLow ?? null,
          estimate_high: doc.quote.estimateHigh ?? null,
          currency: doc.quote.currency ?? null,
          frequency: doc.quote.frequency ?? null,
          service_level: doc.quote.serviceLevel ?? null,
        }
      : null,
    attribution: doc.attribution
      ? {
          utm_source: doc.attribution.utmSource ?? null,
          utm_medium: doc.attribution.utmMedium ?? null,
          utm_campaign: doc.attribution.utmCampaign ?? null,
          has_gclid: Boolean(doc.attribution.gclid),
        }
      : null,
  };
}

function parseLeadAnswers(
  answers: Record<string, unknown>,
  includeRecovery: boolean,
  model?: string
): NonNullable<LeadJev> {
  const hotness = asScore(answers.hotness as never);
  const urgency = asChoice(answers.urgency as never);
  const spam = asNoul(answers.is_spam_or_bot as never);
  const vendor = asNoul(answers.is_vendor_offer as never);
  const jobFit = asNoul(answers.job_fit as never);
  const valueBand = asChoice(answers.value_band as never);
  const recoverability = includeRecovery
    ? asScore(answers.recoverability as never)
    : undefined;
  const bestChannel = includeRecovery
    ? asChoice(answers.best_channel as never)
    : undefined;

  const spamYes = isDecisiveYes(spam?.noul);
  const vendorYes = isDecisiveYes(vendor?.noul);
  const isJunk = spamYes || vendorYes;

  const hotnessHigh =
    (hotness?.score ?? 0) >= 0.66 && isDecisiveScore(hotness?.confidence);
  const jobOk = isDecisiveYes(jobFit?.noul) || (jobFit?.noul ?? 0) >= 0.55;
  const isHot = !isJunk && hotnessHigh && jobOk;

  const urgencyVal = urgency?.choice;
  const valueVal = valueBand?.choice;
  const channelVal = bestChannel?.choice;

  return {
    hotness: hotness?.score,
    hotnessConfidence: hotness?.confidence,
    urgency:
      urgencyVal === "today" ||
      urgencyVal === "this_week" ||
      urgencyVal === "flexible" ||
      urgencyVal === "unknown"
        ? urgencyVal
        : undefined,
    urgencyConfidence: urgency?.confidence,
    isSpamOrBot: spam?.noul,
    isVendorOffer: vendor?.noul,
    jobFit: jobFit?.noul,
    valueBand:
      valueVal === "small" ||
      valueVal === "standard" ||
      valueVal === "large" ||
      valueVal === "unknown"
        ? valueVal
        : undefined,
    valueBandConfidence: valueBand?.confidence,
    recoverability: recoverability?.score,
    recoverabilityConfidence: recoverability?.confidence,
    bestChannel:
      channelVal === "call" ||
      channelVal === "sms" ||
      channelVal === "email" ||
      channelVal === "none"
        ? channelVal
        : undefined,
    bestChannelConfidence: bestChannel?.confidence,
    isJunk,
    isHot,
    model,
    scoredAt: Date.now(),
  };
}

export const getBookingForJevInternal = internalQuery({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.bookingId);
    if (!doc) return null;
    const site = await ctx.db.get(doc.siteId);
    return {
      id: doc._id,
      siteSlug: site?.slug ?? "",
      customerName: doc.customerName,
      email: doc.email,
      phone: doc.phone,
      address: doc.address,
      serviceType: doc.serviceType,
      preferredDate: doc.preferredDate,
      preferredTime: doc.preferredTime,
      notes: doc.notes,
      intent: doc.intent,
      property: doc.property,
      quote: doc.quote,
      attribution: doc.attribution,
      jev: doc.jev,
    };
  },
});

export const getPartialLeadForJevInternal = internalQuery({
  args: { leadId: v.id("partialLeads") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.leadId);
    if (!doc) return null;
    const site = await ctx.db.get(doc.siteId);
    return {
      id: doc._id,
      siteSlug: site?.slug ?? "",
      customerName: doc.customerName,
      email: doc.email,
      phone: doc.phone,
      address: doc.address,
      serviceType: doc.serviceType,
      preferredDate: doc.preferredDate,
      preferredTime: doc.preferredTime,
      notes: doc.notes,
      intent: doc.intent,
      property: doc.property,
      quote: doc.quote,
      attribution: doc.attribution,
      lastStep: doc.lastStep,
      convertedAt: doc.convertedAt,
      jev: doc.jev,
    };
  },
});

export const patchBookingJevInternal = internalMutation({
  args: {
    bookingId: v.id("bookings"),
    jev: leadJevScore,
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.bookingId);
    if (!doc) return;
    await ctx.db.patch(args.bookingId, {
      jev: args.jev,
      updatedAt: Date.now(),
    });
  },
});

export const patchPartialLeadJevInternal = internalMutation({
  args: {
    leadId: v.id("partialLeads"),
    jev: leadJevScore,
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.leadId);
    if (!doc) return;
    await ctx.db.patch(args.leadId, {
      jev: args.jev,
      updatedAt: Date.now(),
    });
  },
});

export const getEmailThreadForJevInternal = internalQuery({
  args: { threadId: v.id("emailThreads") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.threadId);
    if (!doc) return null;
    return {
      id: doc._id,
      subject: doc.subject,
      lastSnippet: doc.lastSnippet,
      participants: doc.participants,
      jevScoredAt: doc.jevScoredAt,
    };
  },
});

export const patchEmailThreadJevInternal = internalMutation({
  args: {
    threadId: v.id("emailThreads"),
    jevBucket: emailJevBucket,
    jevBucketConfidence: v.optional(v.number()),
    jevNeedsReply: v.optional(v.number()),
    jevIsSpam: v.boolean(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.threadId);
    if (!doc) return;
    await ctx.db.patch(args.threadId, {
      jevBucket: args.jevBucket,
      jevBucketConfidence: args.jevBucketConfidence,
      jevNeedsReply: args.jevNeedsReply,
      jevIsSpam: args.jevIsSpam,
      jevScoredAt: Date.now(),
    });
  },
});

type NotifyKind = "quote" | "book" | "abandoned";

function scheduleLeadNotifies(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: { scheduler: { runAfter: (...args: any[]) => Promise<unknown> } },
  args: {
    siteSlug: string;
    customerName: string;
    email?: string;
    phone?: string;
    address?: string;
    serviceType?: string;
    preferredDate?: string;
    preferredTime?: string;
    notes?: string;
    intent?: "quote" | "book";
    quoteEstimate?: number;
    quoteCurrency?: string;
    quoteFrequency?: string;
    bookingId?: Id<"bookings">;
    leadId?: Id<"partialLeads">;
    kind: NotifyKind;
    jev?: NonNullable<LeadJev> | null;
  }
) {
  const quiet = args.jev?.isJunk === true;
  const jevLabel = args.jev
    ? args.jev.isJunk
      ? args.jev.isVendorOffer !== undefined &&
        isDecisiveYes(args.jev.isVendorOffer)
        ? "VENDOR"
        : "SPAM"
      : args.jev.isHot
        ? "HOT"
        : undefined
    : undefined;

  return Promise.all([
    quiet
      ? Promise.resolve()
      : ctx.scheduler.runAfter(0, internal.pushActions.notifyNewBookingInternal, {
          siteSlug: args.siteSlug,
          customerName: args.customerName,
          serviceType: args.serviceType,
          bookingId: args.bookingId,
          intent: args.intent,
          kind: args.kind,
          leadId: args.leadId,
          jevLabel,
          jevUrgency: args.jev?.urgency,
        }),
    // Always Telegram for audit trail; prefix junk so it is easy to ignore.
    ctx.scheduler.runAfter(0, internal.telegramActions.notifyNewBookingInternal, {
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
      quoteEstimate: args.quoteEstimate,
      quoteCurrency: args.quoteCurrency,
      quoteFrequency: args.quoteFrequency,
      bookingId: args.bookingId,
      kind: args.kind,
      leadId: args.leadId,
      jevLabel,
      jevUrgency: args.jev?.urgency,
      jevQuiet: quiet,
    }),
  ]);
}

/**
 * Score a booking with Jev, patch, then fire push/Telegram (delayed from createPublic).
 * Fail-open: missing key or API errors still notify without scores.
 */
export const scoreBookingAndNotifyInternal = internalAction({
  args: {
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.runQuery(internal.jevActions.getBookingForJevInternal, {
      bookingId: args.bookingId,
    });
    if (!booking || !booking.siteSlug) return;

    let jev: NonNullable<LeadJev> | null = booking.jev ?? null;

    if (!jev && jevConfigured()) {
      const result = await decide(
        buildLeadState({ ...booking, kind: "booking" }),
        leadQuestions(false)
      );
      if (result.ok) {
        jev = parseLeadAnswers(result.answers, false, result.model);
        await ctx.runMutation(internal.jevActions.patchBookingJevInternal, {
          bookingId: args.bookingId,
          jev,
        });
      } else {
        console.warn("[jev] booking score skipped:", result.reason);
      }
    }

    await scheduleLeadNotifies(ctx, {
      siteSlug: booking.siteSlug,
      customerName: booking.customerName,
      email: booking.email,
      phone: booking.phone,
      address: booking.address,
      serviceType: booking.serviceType,
      preferredDate: booking.preferredDate,
      preferredTime: booking.preferredTime,
      notes: booking.notes,
      intent: booking.intent,
      quoteEstimate: booking.quote?.estimate,
      quoteCurrency: booking.quote?.currency,
      quoteFrequency: booking.quote?.frequency,
      bookingId: args.bookingId,
      kind: booking.intent === "quote" ? "quote" : "book",
      jev,
    });
  },
});

/**
 * Score a new partial lead (includes recovery fields), then notify.
 */
export const scorePartialLeadAndNotifyInternal = internalAction({
  args: {
    leadId: v.id("partialLeads"),
  },
  handler: async (ctx, args) => {
    const lead = await ctx.runQuery(
      internal.jevActions.getPartialLeadForJevInternal,
      { leadId: args.leadId }
    );
    if (!lead || !lead.siteSlug || lead.convertedAt) return;

    let jev: NonNullable<LeadJev> | null = lead.jev ?? null;

    if (!jev && jevConfigured()) {
      const result = await decide(
        buildLeadState({ ...lead, kind: "partial" }),
        leadQuestions(true)
      );
      if (result.ok) {
        jev = parseLeadAnswers(result.answers, true, result.model);
        await ctx.runMutation(internal.jevActions.patchPartialLeadJevInternal, {
          leadId: args.leadId,
          jev,
        });
      } else {
        console.warn("[jev] partial lead score skipped:", result.reason);
      }
    }

    const customerName =
      lead.customerName || lead.email || lead.phone || "Unknown visitor";

    await scheduleLeadNotifies(ctx, {
      siteSlug: lead.siteSlug,
      customerName,
      email: lead.email,
      phone: lead.phone,
      address: lead.address,
      serviceType: lead.serviceType,
      preferredDate: lead.preferredDate,
      preferredTime: lead.preferredTime,
      notes: lead.notes,
      intent: lead.intent,
      quoteEstimate: lead.quote?.estimate,
      quoteCurrency: lead.quote?.currency,
      quoteFrequency: lead.quote?.frequency,
      leadId: args.leadId,
      kind: "abandoned",
      jev,
    });
  },
});

/**
 * Re-score an existing unscored partial for recovery ranking (no notify).
 */
export const scorePartialLeadInternal = internalAction({
  args: { leadId: v.id("partialLeads") },
  handler: async (ctx, args) => {
    if (!jevConfigured()) return;
    const lead = await ctx.runQuery(
      internal.jevActions.getPartialLeadForJevInternal,
      { leadId: args.leadId }
    );
    if (!lead || lead.convertedAt || lead.jev) return;

    const result = await decide(
      buildLeadState({ ...lead, kind: "partial" }),
      leadQuestions(true)
    );
    if (!result.ok) {
      console.warn("[jev] recovery score skipped:", result.reason);
      return;
    }
    const jev = parseLeadAnswers(result.answers, true, result.model);
    await ctx.runMutation(internal.jevActions.patchPartialLeadJevInternal, {
      leadId: args.leadId,
      jev,
    });
  },
});

export const classifyEmailThreadInternal = internalAction({
  args: { threadId: v.id("emailThreads") },
  handler: async (ctx, args) => {
    if (!jevConfigured()) return;
    const thread = await ctx.runQuery(
      internal.jevActions.getEmailThreadForJevInternal,
      { threadId: args.threadId }
    );
    if (!thread || thread.jevScoredAt) return;

    const result = await decide(
      {
        from_participants: thread.participants.slice(0, 8),
        subject: thread.subject.slice(0, 300),
        snippet: thread.lastSnippet.slice(0, 800),
      },
      {
        bucket: choice(
          "Which inbox bucket does this email belong in for a local cleaning business manager?",
          EMAIL_BUCKET
        ),
        needs_human_reply: noul(
          "Does this email need a human reply from the cleaning business soon?",
          "Yes — a person should reply",
          "No — no reply needed, or only automated handling"
        ),
      }
    );

    if (!result.ok) {
      console.warn("[jev] email classify skipped:", result.reason);
      return;
    }

    const bucketAns = asChoice(result.answers.bucket);
    const needs = asNoul(result.answers.needs_human_reply);
    const raw = bucketAns?.choice;
    const bucket =
      raw === "reply_today" ||
      raw === "booking_related" ||
      raw === "vendor" ||
      raw === "newsletter" ||
      raw === "spam" ||
      raw === "noise" ||
      raw === "unknown"
        ? raw
        : "unknown";

    const decisive =
      bucket === "unknown" ? false : isDecisiveChoice(bucketAns?.confidence);
    const jevIsSpam =
      decisive && (bucket === "spam" || bucket === "vendor" || bucket === "newsletter");

    await ctx.runMutation(internal.jevActions.patchEmailThreadJevInternal, {
      threadId: args.threadId,
      jevBucket: bucket,
      jevBucketConfidence: bucketAns?.confidence,
      jevNeedsReply: needs?.noul,
      jevIsSpam,
    });
  },
});
