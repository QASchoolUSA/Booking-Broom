import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { normalizeUsDigits } from "./lib/phone";
import {
  buildWebhookUrl,
  defaultSyncDateRange,
  deleteMms,
  deleteSms,
  directionFromType,
  extractMmsMediaUrls,
  getMms,
  getSms,
  listDids,
  parseVoipmsDate,
  resolveDidLabel,
  sendSms,
  setSmsCallback,
  type VoipmsMmsRow,
} from "./lib/voipms";

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

export const syncMessagesInternal = internalAction({
  args: {
    daysBack: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ ok: boolean; upserted: number; error: string | null }> => {
    try {
      const range = defaultSyncDateRange(args.daysBack ?? 30);
      const storedDids = await ctx.runQuery(internal.sms.listDidsInternal, {});
      const didList =
        storedDids.length > 0
          ? storedDids.map((d) => d.did)
          : (await listDids()).map((d) => d.did);

      let upserted = 0;
      const errors: string[] = [];

      const ingestSms = async (
        row: {
          id: string;
          date: string;
          type: string;
          did: string;
          contact: string;
          message: string;
        },
        mediaUrls?: string[]
      ) => {
        if (!row.did || !row.contact) return;
        const isMms = (mediaUrls?.length ?? 0) > 0;
        await ctx.runMutation(internal.sms.upsertMessageInternal, {
          voipmsId: row.id,
          did: row.did,
          contact: row.contact,
          direction: directionFromType(row.type),
          type: isMms ? "mms" : "sms",
          body: row.message,
          mediaUrls: mediaUrls?.length ? mediaUrls : undefined,
          sentAt: parseVoipmsDate(row.date),
        });
        upserted += 1;
      };

      if (didList.length === 0) {
        const smsRows = await getSms({
          from: range.from,
          to: range.to,
          limit: 100,
        });
        for (const row of smsRows) await ingestSms(row);

        const mmsRows = await getMms({
          from: range.from,
          to: range.to,
          limit: 100,
        });
        for (const row of mmsRows) {
          await ingestSms(row, extractMmsMediaUrls(row));
        }
      } else {
        for (const did of didList) {
          try {
            const smsRows = await getSms({
              did,
              from: range.from,
              to: range.to,
              limit: 100,
            });
            for (const row of smsRows) await ingestSms(row);

            const mmsRows = await getMms({
              did,
              from: range.from,
              to: range.to,
              limit: 100,
            });
            for (const row of mmsRows) {
              await ingestSms(row, extractMmsMediaUrls(row as VoipmsMmsRow));
            }
          } catch (e) {
            errors.push(
              `${did}: ${e instanceof Error ? e.message : "sync failed"}`
            );
          }
        }
      }

      const error = errors.length > 0 ? errors.slice(0, 3).join("; ") : null;
      await ctx.runMutation(internal.sms.setSyncStateInternal, {
        lastSyncAt: Date.now(),
        lastSyncError: error,
      });

      return { ok: error == null, upserted, error };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Message sync failed";
      await ctx.runMutation(internal.sms.setSyncStateInternal, {
        lastSyncError: message,
      });
      return { ok: false, upserted: 0, error: message };
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
    const messages = await ctx.runAction(
      internal.voipmsActions.syncMessagesInternal,
      { daysBack: 7 }
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
  },
  handler: async (
    ctx,
    args
  ): Promise<{ ok: boolean; upserted: number; error: string | null }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const result = await ctx.runAction(
      internal.voipmsActions.syncMessagesInternal,
      { daysBack: args.daysBack ?? 30 }
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
    if (message.length > 160) {
      throw new Error("SMS is limited to 160 characters");
    }

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

    return { ok: true, voipmsId };
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

    await bestEffortVoipmsDelete(msg.voipmsId, msg.type);

    await ctx.runMutation(internal.sms.deleteMessageInternal, {
      messageId: args.messageId,
    });
    return { ok: true };
  },
});

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

    const did = normalizeUsDigits(args.did);
    const contact = normalizeUsDigits(args.contact);
    if (!did || !contact) throw new Error("Invalid phone number");

    const messages = await ctx.runQuery(
      internal.sms.listConversationMessagesInternal,
      { did, contact }
    );

    for (const msg of messages) {
      await bestEffortVoipmsDelete(msg.voipmsId, msg.type);
    }

    const result = await ctx.runMutation(
      internal.sms.deleteConversationInternal,
      { did, contact }
    );
    return { ok: true, deletedMessages: result.deletedMessages };
  },
});
