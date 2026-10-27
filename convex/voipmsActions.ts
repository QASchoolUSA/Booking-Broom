import { action, internalAction, type ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  normalizeUsDigits,
  shouldSkipCustomerBookingSms,
  smsPartyDigits,
} from "./lib/phone";
import { buildCustomerBookingSms, BOOKING_SMS_MAX } from "./lib/bookingSmsTemplates";
import {
  buildWebhookUrl,
  chunkDateRange,
  defaultSyncDateRange,
  deleteMms,
  deleteSms,
  directionFromType,
  extractMmsMediaUrls,
  getMmsComplete,
  getSmsComplete,
  listDids,
  parseVoipmsDate,
  MMS_TEXT_MAX,
  resolveDidLabel,
  sendMms,
  sendSms,
  setSmsCallback,
  SMS_SEGMENT_MAX,
  VOIPMS_FULL_HISTORY_DAYS,
  VOIPMS_RECENT_OVERLAP_DAYS,
  type VoipmsMmsRow,
  type VoipmsSmsRow,
} from "./lib/voipms";
import { mapPool } from "./lib/mapPool";

const WINDOW_CHUNK_DAYS = 14;
const WINDOW_CONCURRENCY = 6;
const UPSERT_BATCH = 40;

function matchSiteId(
  did: string,
  sites: Array<{ _id: Id<"sites">; phoneNumber?: string }>
): Id<"sites"> | undefined {
  for (const site of sites) {
    if (!site.phoneNumber) continue;
    const digits = normalizeUsDigits(site.phoneNumber);
    if (digits === did) return site._id;
  }
  return undefined;
}

export const syncDidsInternal = internalAction({
  args: {
    configureCallbacks: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ ok: boolean; count: number; error: string | null }> => {
    try {
      const dids = await listDids();
      const sites = await ctx.runQuery(
        internal.sms.listSitesForPhoneMatchInternal,
        {}
      );
      const webhookUrl = buildWebhookUrl();

      for (const did of dids) {
        const siteId = matchSiteId(did.did, sites);
        await ctx.runMutation(internal.sms.upsertDidInternal, {
          did: did.did,
          description: resolveDidLabel({
            calleridPrefix: did.calleridPrefix,
            note: did.note,
            description: did.description,
            subAccount: did.subAccount,
            did: did.did,
          }),
          subAccount: did.subAccount,
          smsEnabled: did.smsEnabled || did.smsAvailable,
          siteId,
        });

        if (
          args.configureCallbacks &&
          webhookUrl &&
          (did.smsEnabled || did.smsAvailable)
        ) {
          try {
            await setSmsCallback({ did: did.did, callbackUrl: webhookUrl });
          } catch {
            // Non-fatal: user can set callbacks manually in Voip.ms portal.
          }
        }
      }

      await ctx.runMutation(internal.sms.setSyncStateInternal, {
        lastDidSyncAt: Date.now(),
        lastSyncError: null,
      });

      return { ok: true, count: dids.length, error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : "DID sync failed";
      await ctx.runMutation(internal.sms.setSyncStateInternal, {
        lastSyncError: message,
      });
      return { ok: false, count: 0, error: message };
    }
  },
});

type IngestRow = {
  voipmsId: string;
  did: string;
  contact: string;
  direction: "in" | "out";
  type: "sms" | "mms";
  body: string;
  mediaUrls?: string[];
  sentAt: number;
};

function toIngestRows(
  smsRows: VoipmsSmsRow[],
  mmsRows: VoipmsMmsRow[]
): IngestRow[] {
  const byId = new Map<string, IngestRow>();
  for (const row of smsRows) {
    if (!row.did || !row.contact || !row.id) continue;
    byId.set(row.id, {
      voipmsId: row.id,
      did: row.did,
      contact: row.contact,
      direction: directionFromType(row.type),
      type: "sms",
      body: row.message,
      sentAt: parseVoipmsDate(row.date),
    });
  }
  for (const row of mmsRows) {
    if (!row.did || !row.contact || !row.id) continue;
    const mediaUrls = extractMmsMediaUrls(row);
    byId.set(row.id, {
      voipmsId: row.id,
      did: row.did,
      contact: row.contact,
      direction: directionFromType(row.type),
      type: mediaUrls.length > 0 ? "mms" : "sms",
      body: row.message,
      mediaUrls: mediaUrls.length ? mediaUrls : undefined,
      sentAt: parseVoipmsDate(row.date),
    });
  }
  return [...byId.values()];
}

/**
 * Pull Voip.ms SMS+MMS into Convex.
 *
 * Strategy (complete + fast):
 * 1. Account-wide fetches (no per-DID loops) — one SMS+MMS stream for all lines.
 * 2. Date windows (14d) in parallel; auto-split any window that hits the API page cap.
 * 3. Batch upserts (40/msg) instead of one mutation per message.
 * 4. `mode: "auto"` — full 365d history once, then recent overlap only.
 */
export const syncMessagesInternal = internalAction({
  args: {
    daysBack: v.optional(v.number()),
    /**
     * auto — full history if never backfilled, else recent overlap (fast).
     * full — always pull `daysBack` (default 365).
     * recent — only the recent overlap window.
     */
    mode: v.optional(
      v.union(v.literal("auto"), v.literal("full"), v.literal("recent"))
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    ok: boolean;
    upserted: number;
    error: string | null;
    from: string;
    to: string;
    mode: string;
  }> => {
    const mode = args.mode ?? "auto";
    try {
      const syncState = await ctx.runQuery(internal.sms.getSyncStateInternal, {});
      const targetFull = defaultSyncDateRange(
        args.daysBack ?? VOIPMS_FULL_HISTORY_DAYS
      );
      const recent = defaultSyncDateRange(VOIPMS_RECENT_OVERLAP_DAYS);

      let range = targetFull;
      let effectiveMode = mode;
      if (mode === "recent") {
        range = recent;
      } else if (mode === "auto") {
        const backfilled = syncState?.historySyncedFrom;
        if (backfilled && backfilled <= targetFull.from) {
          // History already covered — only refresh recent.
          range = recent;
          effectiveMode = "recent";
        } else {
          range = targetFull;
          effectiveMode = "full";
        }
      }

      const windows = chunkDateRange(range.from, range.to, WINDOW_CHUNK_DAYS);
      const errors: string[] = [];
      let upserted = 0;

      const flushBatch = async (batch: IngestRow[]) => {
        if (batch.length === 0) return;
        for (let i = 0; i < batch.length; i += UPSERT_BATCH) {
          const slice = batch.slice(i, i + UPSERT_BATCH);
          const result = await ctx.runMutation(
            internal.sms.upsertMessagesBatchInternal,
            { messages: slice }
          );
          upserted += result.upserted;
        }
      };

      await mapPool(windows, WINDOW_CONCURRENCY, async (window) => {
        try {
          const [smsRows, mmsRows] = await Promise.all([
            getSmsComplete({ from: window.from, to: window.to }),
            getMmsComplete({ from: window.from, to: window.to }),
          ]);
          await flushBatch(toIngestRows(smsRows, mmsRows));
        } catch (e) {
          errors.push(
            `${window.from}→${window.to}: ${
              e instanceof Error ? e.message : "sync failed"
            }`
          );
        }
      });

      const error = errors.length > 0 ? errors.slice(0, 3).join("; ") : null;
      await ctx.runMutation(internal.sms.setSyncStateInternal, {
        lastSyncAt: Date.now(),
        lastSyncError: error,
        // Mark full history coverage only when a full/auto-full pass succeeds.
        ...(error == null &&
        (effectiveMode === "full" || mode === "full")
          ? { historySyncedFrom: range.from }
          : {}),
      });

      return {
        ok: error == null,
        upserted,
        error,
        from: range.from,
        to: range.to,
        mode: effectiveMode,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Message sync failed";
      await ctx.runMutation(internal.sms.setSyncStateInternal, {
        lastSyncError: message,
      });
      return {
        ok: false,
        upserted: 0,
        error: message,
        from: "",
        to: "",
        mode,
      };
    }
  },
});

export const syncAllInternal = internalAction({
  args: {},
  handler: async (
    ctx
  ): Promise<{ ok: boolean; error: string | null }> => {
    const dids = await ctx.runAction(internal.voipmsActions.syncDidsInternal, {
      configureCallbacks: false,
    });
    if (!dids.ok) {
      return { ok: false, error: dids.error };
    }
    // Cron: keep recent fresh; full history is handled by interactive Sync once.
    const messages = await ctx.runAction(
      internal.voipmsActions.syncMessagesInternal,
      { mode: "auto" }
    );
    return {
      ok: messages.ok,
      error: messages.error,
    };
  },
});

export const syncDidsNow = action({
  args: {
    configureCallbacks: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ ok: boolean; count: number; error: string | null }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const result = await ctx.runAction(
      internal.voipmsActions.syncDidsInternal,
      {
        configureCallbacks: args.configureCallbacks ?? true,
      }
    );
    if (!result.ok && result.error) throw new Error(result.error);
    return result;
  },
});

export const syncMessagesNow = action({
  args: {
    daysBack: v.optional(v.number()),
    mode: v.optional(
      v.union(v.literal("auto"), v.literal("full"), v.literal("recent"))
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    ok: boolean;
    upserted: number;
    error: string | null;
    from?: string;
    to?: string;
    mode?: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    // Messages-only. auto = full 365d history once, then fast recent overlap.
    const result = await ctx.runAction(
      internal.voipmsActions.syncMessagesInternal,
      {
        daysBack: args.daysBack,
        mode: args.mode ?? "auto",
      }
    );
    if (!result.ok && result.error?.includes("credentials")) {
      throw new Error(result.error);
    }
    return result;
  },
});

export const sendMessage = action({
  args: {
    did: v.string(),
    contact: v.string(),
    message: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ ok: boolean; voipmsId: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const did = normalizeUsDigits(args.did);
    const contact = normalizeUsDigits(args.contact);
    const message = args.message.trim();
    if (!did || !contact) throw new Error("Invalid phone number");
    if (!message) throw new Error("Message is empty");
    if (message.length > MMS_TEXT_MAX) {
      throw new Error(`Message is limited to ${MMS_TEXT_MAX} characters`);
    }

    const useMms = message.length > SMS_SEGMENT_MAX;
    let voipmsId: string;
    if (useMms) {
      const { mmsId } = await sendMms({ did, dst: contact, message });
      voipmsId = String(mmsId);
    } else {
      const { smsId } = await sendSms({ did, dst: contact, message });
      voipmsId = String(smsId);
    }
    const sentAt = Date.now();

    await ctx.runMutation(internal.sms.upsertMessageInternal, {
      voipmsId,
      did,
      contact,
      direction: "out",
      type: useMms ? "mms" : "sms",
      body: message,
      sentAt,
      status: "sent",
    });

    return { ok: true, voipmsId };
  },
});

const sendBookingSmsArgs = {
  site_slug: v.string(),
  customer_name: v.string(),
  phone: v.optional(v.string()),
  service_type: v.optional(v.string()),
  preferred_date: v.optional(v.string()),
  bookingId: v.optional(v.id("bookings")),
};

type SendBookingSmsResult = {
  sent: boolean;
  skipped?: string;
  voipmsId?: string;
};

async function sendBookingSmsHandler(
  ctx: ActionCtx,
  args: {
    site_slug: string;
    customer_name: string;
    phone?: string;
    service_type?: string;
    preferred_date?: string;
    bookingId?: Id<"bookings">;
  }
): Promise<SendBookingSmsResult> {
  if (shouldSkipCustomerBookingSms(args.phone)) {
    return { sent: false, skipped: "sms_skip_phone" };
  }

  if (args.bookingId) {
    const claim = await ctx.runMutation(
      internal.bookings.claimSmsNotifyInternal,
      { bookingId: args.bookingId }
    );
    if (!claim.claimed) {
      console.info(
        `Booking SMS: skip ${args.bookingId} (${claim.reason})`
      );
      return { sent: false, skipped: `sms_already_${claim.reason}` };
    }
  }

  if (!args.phone?.trim()) {
    return { sent: false, skipped: "no_phone" };
  }

  const contact = normalizeUsDigits(args.phone);
  if (!contact) {
    return { sent: false, skipped: "invalid_phone" };
  }

  const site = await ctx.runQuery(internal.sites.getBySlug, {
    slug: args.site_slug,
  });
  if (!site) {
    return { sent: false, skipped: "unknown_site" };
  }

  const didDoc = await ctx.runQuery(internal.sms.findDidForSiteInternal, {
    siteId: site._id,
  });
  if (!didDoc) {
    return { sent: false, skipped: "no_site_did" };
  }

  const did = normalizeUsDigits(didDoc.did);
  if (!did) {
    return { sent: false, skipped: "invalid_did" };
  }

  const message = buildCustomerBookingSms({
    siteName: site.name,
    customerName: args.customer_name,
    preferredDate: args.preferred_date,
  });
  if (!message || message.length > BOOKING_SMS_MAX) {
    return { sent: false, skipped: "message_too_long" };
  }

  try {
    const { smsId } = await sendSms({ did, dst: contact, message });
    const voipmsId = String(smsId);
    const sentAt = Date.now();

    await ctx.runMutation(internal.sms.upsertMessageInternal, {
      voipmsId,
      did,
      contact,
      direction: "out",
      type: "sms",
      body: message,
      sentAt,
      status: "sent",
    });

    return { sent: true, voipmsId };
  } catch (err) {
    console.error(
      "Booking SMS failed:",
      err instanceof Error ? err.message : err
    );
    return {
      sent: false,
      skipped: err instanceof Error ? err.message : "voipms_send_failed",
    };
  }
}

/**
 * Customer booking confirmation SMS (one segment, ≤160 chars).
 * Prefer bookings.createPublic → sendBookingSmsInternal.
 * Without bookingId, no-ops so stale Next.js hosts neither block nor double-send.
 * Pass bookingId for manual one-shot sends.
 */
export const sendBookingSms = action({
  args: sendBookingSmsArgs,
  handler: async (ctx, args): Promise<SendBookingSmsResult> => {
    if (!args.bookingId) {
      return { sent: false, skipped: "scheduled_from_createPublic" };
    }
    return await sendBookingSmsHandler(ctx, args);
  },
});

/** Scheduled from bookings.createPublic so SMS is not on the HTTP critical path. */
export const sendBookingSmsInternal = internalAction({
  args: sendBookingSmsArgs,
  handler: async (ctx, args): Promise<SendBookingSmsResult> => {
    try {
      const result = await sendBookingSmsHandler(ctx, args);
      if (!result.sent && result.skipped) {
        console.warn("Booking SMS skipped:", result.skipped);
      }
      return result;
    } catch (error) {
      console.error("Failed to send booking SMS:", error);
      return { sent: false, skipped: "internal_send_failed" };
    }
  },
});

async function bestEffortVoipmsDelete(
  voipmsId: string,
  type: "sms" | "mms"
): Promise<void> {
  // Local-only / synthetic ids (e.g. Date.now) aren't on Voip.ms.
  if (!/^\d+$/.test(voipmsId) || voipmsId.length > 12) return;
  try {
    if (type === "mms") await deleteMms(voipmsId);
    else await deleteSms(voipmsId);
  } catch {
    // Best-effort: local delete still proceeds.
  }
}

/** Background Voip.ms cleanup after local-first SMS deletes. */
export const cleanupVoipmsMessages = internalAction({
  args: {
    items: v.array(
      v.object({
        voipmsId: v.string(),
        type: v.union(v.literal("sms"), v.literal("mms")),
      })
    ),
  },
  handler: async (_ctx, args) => {
    const chunk = 8;
    for (let i = 0; i < args.items.length; i += chunk) {
      const batch = args.items.slice(i, i + chunk);
      await Promise.all(
        batch.map((item) => bestEffortVoipmsDelete(item.voipmsId, item.type))
      );
    }
  },
});

/**
 * @deprecated Prefer api.sms.deleteMessage (local-first). Kept for older clients.
 */
export const deleteMessage = action({
  args: {
    messageId: v.id("smsMessages"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ ok: boolean }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const msg = await ctx.runQuery(internal.sms.getMessageInternal, {
      messageId: args.messageId,
    });
    if (!msg) return { ok: true };

    await ctx.runMutation(internal.sms.deleteMessageInternal, {
      messageId: args.messageId,
    });
    await bestEffortVoipmsDelete(msg.voipmsId, msg.type);
    return { ok: true };
  },
});

/**
 * @deprecated Prefer api.sms.deleteConversation (local-first). Kept for older clients.
 */
export const deleteConversation = action({
  args: {
    did: v.string(),
    contact: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ ok: boolean; deletedMessages: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const did = smsPartyDigits(args.did);
    const contact = smsPartyDigits(args.contact);
    if (!did || !contact) throw new Error("Invalid phone number");

    const messages = await ctx.runQuery(
      internal.sms.listConversationMessagesInternal,
      { did, contact }
    );

    const result = await ctx.runMutation(
      internal.sms.deleteConversationInternal,
      { did, contact }
    );

    const chunk = 8;
    for (let i = 0; i < messages.length; i += chunk) {
      const batch = messages.slice(i, i + chunk);
      await Promise.all(
        batch.map((msg: { voipmsId: string; type: "sms" | "mms" }) =>
          bestEffortVoipmsDelete(msg.voipmsId, msg.type)
        )
      );
    }

    return { ok: true, deletedMessages: result.deletedMessages };
  },
});
