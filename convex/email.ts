import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { SPACEMAIL_DEFAULTS } from "./lib/spacemail";

function mapMailbox(
  doc: Doc<"emailMailboxes">,
  site?: Doc<"sites"> | null,
  unreadCount = 0
) {
  return {
    id: doc._id,
    site_id: doc.siteId,
    site_name: site?.name ?? null,
    site_slug: site?.slug ?? null,
    site_accent: site?.accentColor ?? null,
    email: doc.email,
    display_name: doc.displayName ?? site?.name ?? null,
    imap_host: doc.imapHost,
    imap_port: doc.imapPort,
    smtp_host: doc.smtpHost,
    smtp_port: doc.smtpPort,
    status: doc.status,
    unread_count: unreadCount,
    last_sync_at: doc.lastSyncAt
      ? new Date(doc.lastSyncAt).toISOString()
      : null,
    last_sync_error: doc.lastSyncError ? doc.lastSyncError : null,
    created_at: new Date(doc.createdAt).toISOString(),
  };
}

function mapThread(
  doc: Doc<"emailThreads">,
  mailbox?: Doc<"emailMailboxes"> | null,
  site?: Doc<"sites"> | null
) {
  return {
    id: doc._id,
    mailbox_id: doc.mailboxId,
    thread_key: doc.threadKey,
    subject: doc.subject,
    participants: doc.participants,
    last_message_at: new Date(doc.lastMessageAt).toISOString(),
    last_snippet: doc.lastSnippet,
    unread_count: doc.unreadCount,
    message_count: doc.messageCount,
    mailbox_email: mailbox?.email ?? null,
    site_name: site?.name ?? null,
    site_slug: site?.slug ?? null,
  };
}

function mapMessage(doc: Doc<"emailMessages">) {
  return {
    id: doc._id,
    mailbox_id: doc.mailboxId,
    thread_id: doc.threadId,
    uid: doc.uid,
    message_id: doc.messageId,
    in_reply_to: doc.inReplyTo ?? null,
    references: doc.references ?? [],
    direction: doc.direction,
    from: doc.from,
    to: doc.to,
    cc: doc.cc ?? [],
    subject: doc.subject,
    text_body: doc.textBody ?? null,
    html_body: doc.htmlBody ?? null,
    sent_at: new Date(doc.sentAt).toISOString(),
    seen: doc.seen,
    answered: doc.answered ?? false,
    attachments: (doc.attachmentMeta ?? []).map((a) => ({
      filename: a.filename,
      size: a.size,
      content_type: a.contentType,
      storage_id: a.storageId ?? null,
      skipped: a.skipped ?? false,
    })),
  };
}

function mapSyncState(doc: Doc<"emailSyncState">) {
  return {
    id: doc._id,
    last_sync_at: doc.lastSyncAt
      ? new Date(doc.lastSyncAt).toISOString()
      : null,
    last_sync_error: doc.lastSyncError ? doc.lastSyncError : null,
    next_mailbox_index: doc.nextMailboxIndex ?? 0,
  };
}

async function requireIdentity(ctx: {
  auth: { getUserIdentity: () => Promise<unknown> };
}) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  return identity;
}

export const getSyncState = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const state = await ctx.db.query("emailSyncState").first();
    if (!state) return null;
    return mapSyncState(state);
  },
});

export const countUnread = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const threads = await ctx.db.query("emailThreads").collect();
    return threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
  },
});

export const listMailboxes = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const boxes = await ctx.db.query("emailMailboxes").collect();
    const sites = await ctx.db.query("sites").collect();
    const siteMap = new Map(sites.map((s) => [s._id, s]));

    const unreadByMailbox = new Map<string, number>();
    for (const box of boxes) {
      const threads = await ctx.db
        .query("emailThreads")
        .withIndex("by_mailbox_and_lastMessageAt", (q) =>
          q.eq("mailboxId", box._id)
        )
        .collect();
      const unread = threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
      unreadByMailbox.set(box._id, unread);
    }

    return boxes
      .map((b) =>
        mapMailbox(b, siteMap.get(b.siteId), unreadByMailbox.get(b._id) ?? 0)
      )
      .sort((a, b) =>
        (a.site_name || a.email).localeCompare(b.site_name || b.email)
      );
  },
});

/** Sites without a connected mailbox — for Connect UI. */
export const listSitesForConnect = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const sites = await ctx.db.query("sites").collect();
    const boxes = await ctx.db.query("emailMailboxes").collect();
    const connected = new Set(boxes.map((b) => b.siteId));
    return sites
      .filter((s) => !connected.has(s._id))
      .map((s) => ({
        id: s._id,
        slug: s.slug,
        name: s.name,
        contact_email: s.contactEmail ?? null,
        accent_color: s.accentColor,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const listThreads = query({
  args: {
    mailboxId: v.optional(v.id("emailMailboxes")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    let threads: Doc<"emailThreads">[];
    if (args.mailboxId) {
      threads = await ctx.db
        .query("emailThreads")
        .withIndex("by_mailbox_and_lastMessageAt", (q) =>
          q.eq("mailboxId", args.mailboxId!)
        )
        .order("desc")
        .take(200);
    } else {
      // Collect per-mailbox recent threads then merge
      const boxes = await ctx.db.query("emailMailboxes").collect();
      const all: Doc<"emailThreads">[] = [];
      for (const box of boxes) {
        const rows = await ctx.db
          .query("emailThreads")
          .withIndex("by_mailbox_and_lastMessageAt", (q) =>
            q.eq("mailboxId", box._id)
          )
          .order("desc")
          .take(80);
        all.push(...rows);
      }
      all.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      threads = all.slice(0, 250);
    }

    const boxes = await ctx.db.query("emailMailboxes").collect();
    const boxMap = new Map(boxes.map((b) => [b._id, b]));
    const sites = await ctx.db.query("sites").collect();
    const siteMap = new Map(sites.map((s) => [s._id, s]));

    return threads.map((t) => {
      const box = boxMap.get(t.mailboxId);
      const site = box ? siteMap.get(box.siteId) : null;
      return mapThread(t, box, site);
    });
  },
});

export const listMessages = query({
  args: {
    threadId: v.id("emailThreads"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const messages = await ctx.db
      .query("emailMessages")
      .withIndex("by_thread_and_sentAt", (q) =>
        q.eq("threadId", args.threadId)
      )
      .order("asc")
      .take(500);
    return messages.map(mapMessage);
  },
});

export const getAttachmentUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const markThreadReadLocal = mutation({
  args: {
    threadId: v.id("emailThreads"),
  },
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");

    const messages = await ctx.db
      .query("emailMessages")
      .withIndex("by_thread_and_sentAt", (q) =>
        q.eq("threadId", args.threadId)
      )
      .collect();

    const unseenUids: number[] = [];
    for (const m of messages) {
      if (!m.seen) {
        await ctx.db.patch(m._id, { seen: true });
        if (m.uid > 0) unseenUids.push(m.uid);
      }
    }
    if (thread.unreadCount !== 0) {
      await ctx.db.patch(args.threadId, { unreadCount: 0 });
    }
    return {
      mailboxId: thread.mailboxId,
      uids: unseenUids,
    };
  },
});

export const markThreadReadInternal = internalMutation({
  args: {
    threadId: v.id("emailThreads"),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");

    const messages = await ctx.db
      .query("emailMessages")
      .withIndex("by_thread_and_sentAt", (q) =>
        q.eq("threadId", args.threadId)
      )
      .collect();

    const unseenUids: number[] = [];
    for (const m of messages) {
      if (!m.seen) {
        await ctx.db.patch(m._id, { seen: true });
        if (m.uid > 0) unseenUids.push(m.uid);
      }
    }
    if (thread.unreadCount !== 0) {
      await ctx.db.patch(args.threadId, { unreadCount: 0 });
    }
    return {
      mailboxId: thread.mailboxId,
      uids: unseenUids,
    };
  },
});
// ─── Internal helpers for actions ───────────────────────────────────────────

export const getMailboxInternal = internalQuery({
  args: { mailboxId: v.id("emailMailboxes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.mailboxId);
  },
});

export const getThreadInternal = internalQuery({
  args: { threadId: v.id("emailThreads") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.threadId);
  },
});

export const listMessagesInternal = internalQuery({
  args: { threadId: v.id("emailThreads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("emailMessages")
      .withIndex("by_thread_and_sentAt", (q) =>
        q.eq("threadId", args.threadId)
      )
      .order("asc")
      .take(500);
  },
});
export const listConnectedMailboxIdsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const boxes = await ctx.db
      .query("emailMailboxes")
      .withIndex("by_status", (q) => q.eq("status", "connected"))
      .collect();
    const errored = await ctx.db
      .query("emailMailboxes")
      .withIndex("by_status", (q) => q.eq("status", "error"))
      .collect();
    // Include error boxes so cron can retry
    return [...boxes, ...errored]
      .map((b) => b._id)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  },
});

export const getSyncStateInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("emailSyncState").first();
  },
});

export const getSiteInternal = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.siteId);
  },
});

export const findMailboxBySiteInternal = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("emailMailboxes")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .unique();
  },
});

export const upsertMailboxInternal = internalMutation({
  args: {
    siteId: v.id("sites"),
    email: v.string(),
    displayName: v.optional(v.string()),
    imapHost: v.optional(v.string()),
    imapPort: v.optional(v.number()),
    smtpHost: v.optional(v.string()),
    smtpPort: v.optional(v.number()),
    passwordCiphertext: v.string(),
    passwordIv: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("emailMailboxes")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .unique();

    const fields = {
      email: args.email.trim().toLowerCase(),
      displayName: args.displayName,
      imapHost: args.imapHost ?? SPACEMAIL_DEFAULTS.imapHost,
      imapPort: args.imapPort ?? SPACEMAIL_DEFAULTS.imapPort,
      smtpHost: args.smtpHost ?? SPACEMAIL_DEFAULTS.smtpHost,
      smtpPort: args.smtpPort ?? SPACEMAIL_DEFAULTS.smtpPort,
      passwordCiphertext: args.passwordCiphertext,
      passwordIv: args.passwordIv,
      status: "connected" as const,
      lastSyncError: undefined,
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }

    return await ctx.db.insert("emailMailboxes", {
      siteId: args.siteId,
      ...fields,
      createdAt: Date.now(),
    });
  },
});

export const deleteMailboxInternal = internalMutation({
  args: { mailboxId: v.id("emailMailboxes") },
  handler: async (ctx, args) => {
    const threads = await ctx.db
      .query("emailThreads")
      .withIndex("by_mailbox_and_lastMessageAt", (q) =>
        q.eq("mailboxId", args.mailboxId)
      )
      .collect();
    for (const t of threads) {
      const msgs = await ctx.db
        .query("emailMessages")
        .withIndex("by_thread_and_sentAt", (q) => q.eq("threadId", t._id))
        .collect();
      for (const m of msgs) {
        for (const att of m.attachmentMeta ?? []) {
          if (att.storageId) {
            try {
              await ctx.storage.delete(att.storageId);
            } catch {
              // ignore
            }
          }
        }
        await ctx.db.delete(m._id);
      }
      await ctx.db.delete(t._id);
    }
    await ctx.db.delete(args.mailboxId);
  },
});

export const clearMailboxMessagesInternal = internalMutation({
  args: { mailboxId: v.id("emailMailboxes") },
  handler: async (ctx, args) => {
    const threads = await ctx.db
      .query("emailThreads")
      .withIndex("by_mailbox_and_lastMessageAt", (q) =>
        q.eq("mailboxId", args.mailboxId)
      )
      .collect();
    for (const t of threads) {
      const msgs = await ctx.db
        .query("emailMessages")
        .withIndex("by_thread_and_sentAt", (q) => q.eq("threadId", t._id))
        .collect();
      for (const m of msgs) {
        for (const att of m.attachmentMeta ?? []) {
          if (att.storageId) {
            try {
              await ctx.storage.delete(att.storageId);
            } catch {
              // ignore
            }
          }
        }
        await ctx.db.delete(m._id);
      }
      await ctx.db.delete(t._id);
    }
    await ctx.db.patch(args.mailboxId, {
      uidValidity: undefined,
      lastUid: undefined,
    });
  },
});

export const setMailboxSyncCursorInternal = internalMutation({
  args: {
    mailboxId: v.id("emailMailboxes"),
    uidValidity: v.number(),
    lastUid: v.number(),
    lastSyncAt: v.number(),
    lastSyncError: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("connected"),
        v.literal("error"),
        v.literal("disabled")
      )
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.mailboxId, {
      uidValidity: args.uidValidity,
      lastUid: args.lastUid,
      lastSyncAt: args.lastSyncAt,
      lastSyncError: args.lastSyncError,
      ...(args.status ? { status: args.status } : {}),
    });
  },
});

export const setMailboxErrorInternal = internalMutation({
  args: {
    mailboxId: v.id("emailMailboxes"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.mailboxId, {
      status: "error",
      lastSyncError: args.error,
      lastSyncAt: Date.now(),
    });
  },
});

export const setSyncStateInternal = internalMutation({
  args: {
    lastSyncAt: v.optional(v.number()),
    lastSyncError: v.optional(v.string()),
    nextMailboxIndex: v.optional(v.number()),
    clearError: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("emailSyncState").first();
    const patch: {
      lastSyncAt?: number;
      lastSyncError?: string;
      nextMailboxIndex?: number;
    } = {};
    if (args.lastSyncAt !== undefined) patch.lastSyncAt = args.lastSyncAt;
    if (args.nextMailboxIndex !== undefined) {
      patch.nextMailboxIndex = args.nextMailboxIndex;
    }
    if (args.clearError) {
      // Convex can't unset easily — set empty and treat empty as none in UI
      patch.lastSyncError = "";
    } else if (args.lastSyncError !== undefined) {
      patch.lastSyncError = args.lastSyncError;
    }

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("emailSyncState", patch);
  },
});

const attachmentMetaValidator = v.object({
  filename: v.string(),
  size: v.number(),
  contentType: v.string(),
  storageId: v.optional(v.id("_storage")),
  skipped: v.optional(v.boolean()),
});

export const upsertSyncedMessageInternal = internalMutation({
  args: {
    mailboxId: v.id("emailMailboxes"),
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
    threadKey: v.string(),
    snippet: v.string(),
    participants: v.array(v.string()),
    attachmentMeta: v.optional(v.array(attachmentMetaValidator)),
  },
  handler: async (ctx, args) => {
    const byMid = await ctx.db
      .query("emailMessages")
      .withIndex("by_mailbox_and_messageId", (q) =>
        q.eq("mailboxId", args.mailboxId).eq("messageId", args.messageId)
      )
      .unique();

    let thread = await ctx.db
      .query("emailThreads")
      .withIndex("by_mailbox_and_threadKey", (q) =>
        q.eq("mailboxId", args.mailboxId).eq("threadKey", args.threadKey)
      )
      .unique();

    if (!thread) {
      const threadId = await ctx.db.insert("emailThreads", {
        mailboxId: args.mailboxId,
        threadKey: args.threadKey,
        subject: args.subject,
        participants: args.participants,
        lastMessageAt: args.sentAt,
        lastSnippet: args.snippet,
        unreadCount: args.seen ? 0 : 1,
        messageCount: 1,
      });
      thread = (await ctx.db.get(threadId))!;
    }

    if (byMid) {
      await ctx.db.patch(byMid._id, {
        uid: args.uid,
        seen: args.seen,
        answered: args.answered,
        textBody: args.textBody,
        htmlBody: args.htmlBody,
        attachmentMeta: args.attachmentMeta,
      });
      return { messageId: byMid._id, threadId: byMid.threadId, created: false };
    }

    const byUid = await ctx.db
      .query("emailMessages")
      .withIndex("by_mailbox_and_uid", (q) =>
        q.eq("mailboxId", args.mailboxId).eq("uid", args.uid)
      )
      .unique();
    if (byUid) {
      await ctx.db.patch(byUid._id, {
        messageId: args.messageId,
        seen: args.seen,
        answered: args.answered,
      });
      return { messageId: byUid._id, threadId: byUid.threadId, created: false };
    }

    const messageDocId = await ctx.db.insert("emailMessages", {
      mailboxId: args.mailboxId,
      threadId: thread._id,
      uid: args.uid,
      messageId: args.messageId,
      inReplyTo: args.inReplyTo,
      references: args.references,
      direction: args.direction,
      from: args.from,
      to: args.to,
      cc: args.cc,
      subject: args.subject,
      textBody: args.textBody,
      htmlBody: args.htmlBody,
      sentAt: args.sentAt,
      seen: args.seen,
      answered: args.answered,
      attachmentMeta: args.attachmentMeta,
    });

    const unreadBump = args.seen ? 0 : 1;
    const patch: Partial<Doc<"emailThreads">> = {
      messageCount: thread.messageCount + 1,
      unreadCount: thread.unreadCount + unreadBump,
    };
    if (args.sentAt >= thread.lastMessageAt) {
      patch.lastMessageAt = args.sentAt;
      patch.lastSnippet = args.snippet;
      patch.subject = args.subject;
      patch.participants = args.participants;
    }
    await ctx.db.patch(thread._id, patch);

    return { messageId: messageDocId, threadId: thread._id, created: true };
  },
});

export const insertOutboundMessageInternal = internalMutation({
  args: {
    mailboxId: v.id("emailMailboxes"),
    threadId: v.optional(v.id("emailThreads")),
    threadKey: v.string(),
    messageId: v.string(),
    inReplyTo: v.optional(v.string()),
    references: v.optional(v.array(v.string())),
    from: v.string(),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    subject: v.string(),
    textBody: v.string(),
    htmlBody: v.optional(v.string()),
    sentAt: v.number(),
    snippet: v.string(),
    participants: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    let threadId = args.threadId;
    let thread: Doc<"emailThreads"> | null = threadId
      ? await ctx.db.get(threadId)
      : null;

    if (!thread) {
      thread = await ctx.db
        .query("emailThreads")
        .withIndex("by_mailbox_and_threadKey", (q) =>
          q.eq("mailboxId", args.mailboxId).eq("threadKey", args.threadKey)
        )
        .unique();
    }

    if (!thread) {
      threadId = await ctx.db.insert("emailThreads", {
        mailboxId: args.mailboxId,
        threadKey: args.threadKey,
        subject: args.subject,
        participants: args.participants,
        lastMessageAt: args.sentAt,
        lastSnippet: args.snippet,
        unreadCount: 0,
        messageCount: 1,
      });
      thread = (await ctx.db.get(threadId))!;
    } else {
      threadId = thread._id;
      await ctx.db.patch(thread._id, {
        lastMessageAt: args.sentAt,
        lastSnippet: args.snippet,
        subject: args.subject,
        participants: args.participants,
        messageCount: thread.messageCount + 1,
      });
    }

    const id = await ctx.db.insert("emailMessages", {
      mailboxId: args.mailboxId,
      threadId: threadId!,
      uid: 0,
      messageId: args.messageId,
      inReplyTo: args.inReplyTo,
      references: args.references,
      direction: "out",
      from: args.from,
      to: args.to,
      cc: args.cc,
      subject: args.subject,
      textBody: args.textBody,
      htmlBody: args.htmlBody,
      sentAt: args.sentAt,
      seen: true,
      answered: false,
    });

    if (args.inReplyTo) {
      // Mark parent as answered locally if present
      const parent = await ctx.db
        .query("emailMessages")
        .withIndex("by_mailbox_and_messageId", (q) =>
          q.eq("mailboxId", args.mailboxId).eq("messageId", args.inReplyTo!)
        )
        .unique();
      if (parent) {
        await ctx.db.patch(parent._id, { answered: true });
      }
    }

    return { messageId: id, threadId: threadId! };
  },
});
