"use node";

import { action, internalAction, type ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { encryptPassword, decryptPassword } from "./lib/spacemailCrypto";
import {
  SPACEMAIL_DEFAULTS,
  clampMessageBodies,
  computeThreadKey,
  normalizeEmailAddress,
  snippetFromBodies,
} from "./lib/spacemail";
import {
  buildAdminBookingEmail,
  buildCustomerBookingEmail,
  isValidEmail,
  type BookingEmailPayload,
} from "./lib/bookingEmailTemplates";
import {
  appendToSent,
  buildRawMime,
  deleteImapUids,
  fetchInboxIncremental,
  markImapSeen,
  sendSmtpMail,
  testImapSmtp,
  type MailboxConn,
  type ParsedInboundMessage,
} from "./lib/emailSync";

function connFromMailbox(box: {
  email: string;
  passwordCiphertext: string;
  passwordIv: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  displayName?: string;
}): MailboxConn {
  return {
    email: box.email,
    password: decryptPassword(box.passwordCiphertext, box.passwordIv),
    imapHost: box.imapHost,
    imapPort: box.imapPort,
    smtpHost: box.smtpHost,
    smtpPort: box.smtpPort,
  };
}

async function persistParsedMessages(
  ctx: ActionCtx,
  mailboxId: Id<"emailMailboxes">,
  messages: ParsedInboundMessage[]
): Promise<number> {
  let upserted = 0;
  for (const msg of messages) {
    const attachmentMeta: Array<{
      filename: string;
      size: number;
      contentType: string;
      storageId?: Id<"_storage">;
      skipped?: boolean;
    }> = [];

    for (const att of msg.attachments) {
      if (att.skipped || !att.content) {
        attachmentMeta.push({
          filename: att.filename,
          size: att.size,
          contentType: att.contentType,
          skipped: true,
        });
        continue;
      }
      try {
        const storageId = await ctx.storage.store(
          new Blob([new Uint8Array(att.content)], {
            type: att.contentType,
          })
        );
        attachmentMeta.push({
          filename: att.filename,
          size: att.size,
          contentType: att.contentType,
          storageId,
        });
      } catch {
        attachmentMeta.push({
          filename: att.filename,
          size: att.size,
          contentType: att.contentType,
          skipped: true,
        });
      }
    }

    const bodies = clampMessageBodies({
      textBody: msg.textBody,
      htmlBody: msg.htmlBody,
    });

    await ctx.runMutation(internal.email.upsertSyncedMessageInternal, {
      mailboxId,
      uid: msg.uid,
      messageId: msg.messageId,
      inReplyTo: msg.inReplyTo,
      references: msg.references,
      direction: msg.direction,
      from: msg.from,
      to: msg.to,
      cc: msg.cc.length ? msg.cc : undefined,
      subject: msg.subject,
      textBody: bodies.textBody,
      htmlBody: bodies.htmlBody,
      sentAt: msg.sentAt,
      seen: msg.seen,
      answered: msg.answered,
      threadKey: msg.threadKey,
      snippet: msg.snippet,
      participants: msg.participants,
      attachmentMeta: attachmentMeta.length ? attachmentMeta : undefined,
    });
    upserted += 1;
  }
  return upserted;
}

async function syncOneMailbox(
  ctx: ActionCtx,
  mailboxId: Id<"emailMailboxes">
): Promise<{ upserted: number; removed: number; error: string | null }> {
  const box = await ctx.runQuery(internal.email.getMailboxInternal, {
    mailboxId,
  });
  if (!box) return { upserted: 0, removed: 0, error: "Mailbox not found" };

  try {
    const conn = connFromMailbox(box);
    const result = await fetchInboxIncremental(conn, {
      uidValidity: box.uidValidity,
      lastUid: box.lastUid,
    });

    if (result.reset) {
      await ctx.runMutation(internal.email.clearMailboxMessagesInternal, {
        mailboxId,
      });
    }

    const upserted = await persistParsedMessages(
      ctx,
      mailboxId,
      result.messages
    );

    // Reconcile remote deletes only when we have a complete INBOX UID list.
    let removed = 0;
    if (result.inboxUidsComplete) {
      const remoteSet = new Set(result.inboxUids);
      const localUids: number[] = await ctx.runQuery(
        internal.email.listLocalInboxUidsInternal,
        { mailboxId }
      );
      const vanished = localUids.filter((uid) => !remoteSet.has(uid));
      if (vanished.length > 0) {
        const CHUNK = 200;
        for (let i = 0; i < vanished.length; i += CHUNK) {
          const slice = vanished.slice(i, i + CHUNK);
          const r = await ctx.runMutation(
            internal.email.removeVanishedMessagesInternal,
            { mailboxId, uids: slice }
          );
          removed += r.removed;
        }
      }
    }

    await ctx.runMutation(internal.email.setMailboxSyncCursorInternal, {
      mailboxId,
      uidValidity: result.uidValidity,
      lastUid: result.lastUid,
      lastSyncAt: Date.now(),
      lastSyncError: "",
      status: "connected",
    });

    await ctx.runMutation(internal.email.recomputeMailboxUnreadInternal, {
      mailboxId,
    });

    return { upserted, removed, error: null };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Sync failed";
    await ctx.runMutation(internal.email.setMailboxErrorInternal, {
      mailboxId,
      error,
    });
    return { upserted: 0, removed: 0, error };
  }
}

export const connectMailbox = action({
  args: {
    siteId: v.id("sites"),
    email: v.string(),
    password: v.string(),
    displayName: v.optional(v.string()),
    imapHost: v.optional(v.string()),
    imapPort: v.optional(v.number()),
    smtpHost: v.optional(v.string()),
    smtpPort: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    mailboxId: Id<"emailMailboxes">;
    synced: number;
    syncError: string | null;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const site = await ctx.runQuery(internal.email.getSiteInternal, {
      siteId: args.siteId,
    });
    if (!site) throw new Error("Site not found");

    const email = args.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Invalid email address");
    if (!args.password) throw new Error("Password is required");

    const conn: MailboxConn = {
      email,
      password: args.password,
      imapHost: args.imapHost ?? SPACEMAIL_DEFAULTS.imapHost,
      imapPort: args.imapPort ?? SPACEMAIL_DEFAULTS.imapPort,
      smtpHost: args.smtpHost ?? SPACEMAIL_DEFAULTS.smtpHost,
      smtpPort: args.smtpPort ?? SPACEMAIL_DEFAULTS.smtpPort,
    };

    await testImapSmtp(conn);

    const { ciphertext, iv } = encryptPassword(args.password);
    const mailboxId: Id<"emailMailboxes"> = await ctx.runMutation(
      internal.email.upsertMailboxInternal,
      {
        siteId: args.siteId,
        email,
        displayName: args.displayName ?? site.name,
        imapHost: conn.imapHost,
        imapPort: conn.imapPort,
        smtpHost: conn.smtpHost,
        smtpPort: conn.smtpPort,
        passwordCiphertext: ciphertext,
        passwordIv: iv,
      }
    );

    const sync = await syncOneMailbox(ctx, mailboxId);
    return {
      mailboxId,
      synced: sync.upserted,
      syncError: sync.error,
    };
  },
});

export const disconnectMailbox = action({
  args: {
    mailboxId: v.id("emailMailboxes"),
  },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    await ctx.runMutation(internal.email.deleteMailboxInternal, {
      mailboxId: args.mailboxId,
    });
    return { ok: true };
  },
});

export const syncMailboxNow = action({
  args: {
    mailboxId: v.optional(v.id("emailMailboxes")),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    upserted: number;
    removed: number;
    error: string | null;
    mailboxes: number;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (args.mailboxId) {
      const result = await syncOneMailbox(ctx, args.mailboxId);
      await ctx.runMutation(internal.email.setSyncStateInternal, {
        lastSyncAt: Date.now(),
        clearError: !result.error,
        lastSyncError: result.error ?? undefined,
      });
      return {
        upserted: result.upserted,
        removed: result.removed,
        error: result.error,
        mailboxes: 1,
      };
    }

    const ids: Id<"emailMailboxes">[] = await ctx.runQuery(
      internal.email.listConnectedMailboxIdsInternal,
      {}
    );
    let upserted = 0;
    let removed = 0;
    const errors: string[] = [];
    for (const id of ids) {
      const result = await syncOneMailbox(ctx, id);
      upserted += result.upserted;
      removed += result.removed;
      if (result.error) errors.push(result.error);
    }
    const error = errors.length ? errors.slice(0, 3).join("; ") : null;
    await ctx.runMutation(internal.email.setSyncStateInternal, {
      lastSyncAt: Date.now(),
      clearError: !error,
      lastSyncError: error ?? undefined,
    });
    return { upserted, removed, error, mailboxes: ids.length };
  },
});

/**
 * Delete a thread in Booking Broom and permanently remove its INBOX UIDs
 * from SpaceMail (\\Deleted + expunge).
 */
export const deleteThread = action({
  args: { threadId: v.id("emailThreads") },
  handler: async (
    ctx,
    args
  ): Promise<{ ok: true; deleted: number; imapError: string | null }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const thread = await ctx.runQuery(internal.email.getThreadInternal, {
      threadId: args.threadId,
    });
    if (!thread) return { ok: true as const, deleted: 0, imapError: null };

    const messages = await ctx.runQuery(internal.email.listMessagesInternal, {
      threadId: args.threadId,
    });
    const uids = messages.map((m) => m.uid).filter((u) => u > 0);

    let imapError: string | null = null;
    if (uids.length > 0) {
      const box = await ctx.runQuery(internal.email.getMailboxInternal, {
        mailboxId: thread.mailboxId,
      });
      if (box) {
        try {
          await deleteImapUids(connFromMailbox(box), uids);
        } catch (e) {
          imapError = e instanceof Error ? e.message : "IMAP delete failed";
        }
      }
    }

    const local = await ctx.runMutation(
      internal.email.deleteThreadLocalInternal,
      { threadId: args.threadId }
    );

    return {
      ok: true as const,
      deleted: local.deleted,
      imapError,
    };
  },
});

/** Cron: sync one mailbox per tick (round-robin). */
export const syncNextMailboxInternal = internalAction({
  args: {},
  handler: async (
    ctx
  ): Promise<
    | { skipped: true }
    | {
        mailboxId: Id<"emailMailboxes">;
        upserted: number;
        removed: number;
        error: string | null;
      }
  > => {
    const ids: Id<"emailMailboxes">[] = await ctx.runQuery(
      internal.email.listConnectedMailboxIdsInternal,
      {}
    );
    if (ids.length === 0) {
      await ctx.runMutation(internal.email.setSyncStateInternal, {
        lastSyncAt: Date.now(),
        clearError: true,
      });
      return { skipped: true as const };
    }

    const state = await ctx.runQuery(internal.email.getSyncStateInternal, {});
    const index = (state?.nextMailboxIndex ?? 0) % ids.length;
    const mailboxId = ids[index]!;
    const result = await syncOneMailbox(ctx, mailboxId);

    await ctx.runMutation(internal.email.setSyncStateInternal, {
      lastSyncAt: Date.now(),
      nextMailboxIndex: (index + 1) % ids.length,
      clearError: !result.error,
      lastSyncError: result.error ?? undefined,
    });

    return {
      mailboxId,
      upserted: result.upserted,
      removed: result.removed,
      error: result.error,
    };
  },
});

export const markSeen = action({
  args: {
    threadId: v.id("emailThreads"),
  },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const local = await ctx.runMutation(internal.email.markThreadReadInternal, {
      threadId: args.threadId,
    });

    if (local.uids.length === 0) return { ok: true };

    const box = await ctx.runQuery(internal.email.getMailboxInternal, {
      mailboxId: local.mailboxId,
    });
    if (!box) return { ok: true };

    try {
      const conn = connFromMailbox(box);
      await markImapSeen(conn, local.uids);
    } catch {
      // Local already marked; IMAP flag is best-effort
    }
    return { ok: true };
  },
});

export const sendReply = action({
  args: {
    threadId: v.id("emailThreads"),
    text: v.string(),
    html: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ messageId: string; threadId: Id<"emailThreads"> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const text = args.text.trim();
    if (!text) throw new Error("Message body is required");

    const thread = await ctx.runQuery(internal.email.getThreadInternal, {
      threadId: args.threadId,
    });
    if (!thread) throw new Error("Thread not found");

    const box = await ctx.runQuery(internal.email.getMailboxInternal, {
      mailboxId: thread.mailboxId,
    });
    if (!box) throw new Error("Mailbox not found");

    const messages = await ctx.runQuery(internal.email.listMessagesInternal, {
      threadId: args.threadId,
    });
    const lastIn =
      [...messages].reverse().find((m) => m.direction === "in") ??
      messages[messages.length - 1];
    if (!lastIn) throw new Error("No messages in thread");

    const mailboxNorm = normalizeEmailAddress(box.email);
    const replyTo = normalizeEmailAddress(lastIn.from);
    let to: string[] =
      replyTo === mailboxNorm
        ? lastIn.to.filter(
            (t: string) => normalizeEmailAddress(t) !== mailboxNorm
          )
        : [replyTo];
    if (to.length === 0) {
      to = lastIn.to.filter(
        (t: string) => normalizeEmailAddress(t) !== mailboxNorm
      );
    }
    if (to.length === 0) throw new Error("Could not determine reply recipient");

    const subject = /^re:/i.test(lastIn.subject)
      ? lastIn.subject
      : `Re: ${lastIn.subject}`;

    const refs = [...(lastIn.references ?? []), lastIn.messageId].filter(
      Boolean
    );

    const conn = connFromMailbox(box);
    const { messageId } = await sendSmtpMail({
      conn,
      fromName: box.displayName,
      to,
      subject,
      text,
      html: args.html,
      inReplyTo: lastIn.messageId,
      references: refs,
    });

    const from = box.displayName
      ? `${box.displayName} <${box.email}>`
      : box.email;
    const participants = [
      ...new Set(
        [
          mailboxNorm,
          ...to.map(normalizeEmailAddress),
          ...thread.participants,
        ].filter(Boolean)
      ),
    ];
    const sentAt = Date.now();
    const snippet = snippetFromBodies(text, args.html);

    await ctx.runMutation(internal.email.insertOutboundMessageInternal, {
      mailboxId: box._id,
      threadId: thread._id,
      threadKey: thread.threadKey,
      messageId,
      inReplyTo: lastIn.messageId,
      references: refs,
      from,
      to,
      subject,
      textBody: text,
      htmlBody: args.html,
      sentAt,
      snippet,
      participants,
    });

    try {
      const raw = buildRawMime({
        from,
        to,
        subject,
        text,
        messageId,
        inReplyTo: lastIn.messageId,
        references: refs,
      });
      await appendToSent(conn, raw);
    } catch {
      // ignore
    }

    return { messageId, threadId: thread._id };
  },
});

export const sendNew = action({
  args: {
    mailboxId: v.id("emailMailboxes"),
    to: v.array(v.string()),
    subject: v.string(),
    text: v.string(),
    html: v.optional(v.string()),
    cc: v.optional(v.array(v.string())),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ messageId: string; threadId: Id<"emailThreads"> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const text = args.text.trim();
    const subject = args.subject.trim() || "(no subject)";
    const to = args.to.map((t) => t.trim()).filter(Boolean);
    if (to.length === 0) throw new Error("Recipient is required");
    if (!text) throw new Error("Message body is required");

    const box = await ctx.runQuery(internal.email.getMailboxInternal, {
      mailboxId: args.mailboxId,
    });
    if (!box) throw new Error("Mailbox not found");

    const conn = connFromMailbox(box);
    const { messageId } = await sendSmtpMail({
      conn,
      fromName: box.displayName,
      to,
      cc: args.cc,
      subject,
      text,
      html: args.html,
    });

    const from = box.displayName
      ? `${box.displayName} <${box.email}>`
      : box.email;
    const mailboxNorm = normalizeEmailAddress(box.email);
    const participants = [
      ...new Set(
        [
          mailboxNorm,
          ...to.map(normalizeEmailAddress),
          ...(args.cc ?? []).map(normalizeEmailAddress),
        ].filter(Boolean)
      ),
    ];
    const threadKey = computeThreadKey({
      messageId,
      subject,
      participants,
    });
    const sentAt = Date.now();
    const snippet = snippetFromBodies(text, args.html);

    const inserted: {
      messageId: Id<"emailMessages">;
      threadId: Id<"emailThreads">;
    } = await ctx.runMutation(internal.email.insertOutboundMessageInternal, {
      mailboxId: box._id,
      threadKey,
      messageId,
      from,
      to,
      cc: args.cc,
      subject,
      textBody: text,
      htmlBody: args.html,
      sentAt,
      snippet,
      participants,
    });

    try {
      const raw = buildRawMime({
        from,
        to,
        subject,
        text,
        messageId,
      });
      await appendToSent(conn, raw);
    } catch {
      // ignore
    }

    return {
      messageId,
      threadId: inserted.threadId,
    };
  },
});

/** Snake_case property shape as sent by site booking APIs (must accept Sanford extras). */
const bookingPropertyValidator = v.optional(
  v.object({
    bedrooms: v.optional(v.number()),
    bathrooms: v.optional(v.number()),
    square_feet: v.optional(v.number()),
    size_label: v.optional(v.string()),
    home_type: v.optional(v.string()),
    condition: v.optional(v.string()),
    occupants: v.optional(v.number()),
    last_cleaned: v.optional(v.string()),
    excluded_areas: v.optional(v.array(v.string())),
  })
);

const bookingQuoteValidator = v.optional(
  v.object({
    estimate: v.optional(v.number()),
    estimate_low: v.optional(v.number()),
    estimate_high: v.optional(v.number()),
    recurring_estimate: v.optional(v.number()),
    currency: v.optional(v.string()),
    service_level: v.optional(v.string()),
    frequency: v.optional(v.string()),
    add_ons: v.optional(
      v.array(
        v.object({
          label: v.string(),
          price: v.optional(v.number()),
          quantity: v.optional(v.number()),
        })
      )
    ),
    payment_terms: v.optional(v.string()),
    internal: v.optional(v.boolean()),
  })
);

const sendBookingEmailsArgs = {
  site_slug: v.string(),
  customer_name: v.string(),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  address: v.optional(v.string()),
  service_type: v.optional(v.string()),
  preferred_date: v.optional(v.string()),
  preferred_time: v.optional(v.string()),
  notes: v.optional(v.string()),
  property: bookingPropertyValidator,
  quote: bookingQuoteValidator,
  bookingId: v.optional(v.id("bookings")),
};

type SendBookingEmailsResult = {
  sent: boolean;
  via: "mailbox" | "shared_smtp" | "none";
  errors?: string[];
};

async function sendBookingEmailsHandler(
  ctx: ActionCtx,
  args: {
    site_slug: string;
    customer_name: string;
    email?: string;
    phone?: string;
    address?: string;
    service_type?: string;
    preferred_date?: string;
    preferred_time?: string;
    notes?: string;
    property?: BookingEmailPayload["property"];
    quote?: BookingEmailPayload["quote"];
    bookingId?: Id<"bookings">;
  }
): Promise<SendBookingEmailsResult> {
  if (args.bookingId) {
    const claim = await ctx.runMutation(
      internal.bookings.claimEmailNotifyInternal,
      { bookingId: args.bookingId }
    );
    if (!claim.claimed) {
      console.info(
        `Booking email: skip ${args.bookingId} (${claim.reason})`
      );
      return {
        sent: false,
        via: "none",
        errors: [`email_already_${claim.reason}`],
      };
    }
  }

  const payload: BookingEmailPayload = {
    site_slug: args.site_slug,
    customer_name: args.customer_name,
    email: args.email,
    phone: args.phone,
    address: args.address,
    service_type: args.service_type,
    preferred_date: args.preferred_date,
    preferred_time: args.preferred_time,
    notes: args.notes,
    property: args.property,
    quote: args.quote,
  };

  const site = await ctx.runQuery(internal.sites.getBySlug, {
    slug: args.site_slug,
  });
  const siteName = site?.name ?? args.site_slug;
  const siteContactEmail = site?.contactEmail ?? undefined;

  const mailbox = site
    ? await ctx.runQuery(internal.email.findMailboxBySiteInternal, {
        siteId: site._id,
      })
    : null;

  let conn: MailboxConn | null = null;
  let fromHeader = "";
  let adminTo: string | undefined;
  let via: "mailbox" | "shared_smtp" | "none" = "none";

  if (mailbox && mailbox.status !== "disabled") {
    try {
      conn = connFromMailbox(mailbox);
      fromHeader = mailbox.displayName
        ? `${mailbox.displayName} <${mailbox.email}>`
        : `${siteName} <${mailbox.email}>`;
      adminTo = mailbox.email;
      via = "mailbox";
    } catch (e) {
      // Fall through to shared SMTP if decrypt/key missing
      console.error(
        "Mailbox SMTP unavailable:",
        e instanceof Error ? e.message : e
      );
    }
  }

  if (!conn) {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
      return { sent: false, via: "none" };
    }
    conn = {
      email: user,
      password: pass,
      smtpHost: host,
      smtpPort: Number(process.env.SMTP_PORT ?? 465),
    };
    const fromEmail = siteContactEmail ?? process.env.SMTP_FROM ?? user;
    fromHeader =
      process.env.SMTP_FROM && process.env.SMTP_FROM.includes("<")
        ? process.env.SMTP_FROM
        : `${siteName} <${fromEmail}>`;
    // Prefer bare address inside angle brackets for Reply-To/admin
    const angle = fromHeader.match(/<([^>]+)>/);
    adminTo = siteContactEmail ?? angle?.[1] ?? user;
    via = "shared_smtp";
  }

  const errors: string[] = [];
  const replyToSite =
    adminTo ?? (fromHeader.match(/<([^>]+)>/)?.[1] ?? conn.email);

  if (payload.email && isValidEmail(payload.email)) {
    const { subject, text, html } = buildCustomerBookingEmail(
      siteName,
      payload,
      { accentColor: site?.accentColor }
    );
    try {
      await sendSmtpMail({
        conn,
        from: fromHeader,
        fromName: siteName,
        replyTo: replyToSite,
        to: [payload.email.trim()],
        subject,
        text,
        html,
      });
    } catch (err) {
      errors.push(
        `Customer email failed: ${err instanceof Error ? err.message : "unknown error"}`
      );
    }
  }

  if (adminTo) {
    const { subject, text, html } = buildAdminBookingEmail(siteName, payload, {
      accentColor: site?.accentColor,
    });
    try {
      await sendSmtpMail({
        conn,
        from: fromHeader,
        fromName: siteName,
        replyTo:
          payload.email && isValidEmail(payload.email)
            ? payload.email.trim()
            : undefined,
        to: [adminTo],
        subject,
        text,
        html,
      });
    } catch (err) {
      errors.push(
        `Admin email failed: ${err instanceof Error ? err.message : "unknown error"}`
      );
    }
  }

  return {
    sent: errors.length === 0,
    via,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Send customer confirmation + admin alert for a new booking.
 * Prefer bookings.createPublic → sendBookingEmailsInternal.
 * Without bookingId, no-ops so stale Next.js hosts neither block nor double-send.
 * Pass bookingId for manual one-shot sends.
 */
export const sendBookingEmails = action({
  args: sendBookingEmailsArgs,
  handler: async (ctx, args): Promise<SendBookingEmailsResult> => {
    if (!args.bookingId) {
      return { sent: false, via: "none", errors: ["scheduled_from_createPublic"] };
    }
    return await sendBookingEmailsHandler(ctx, args);
  },
});

/** Scheduled from bookings.createPublic so email is not on the HTTP critical path. */
export const sendBookingEmailsInternal = internalAction({
  args: sendBookingEmailsArgs,
  handler: async (ctx, args): Promise<SendBookingEmailsResult> => {
    try {
      const result = await sendBookingEmailsHandler(ctx, args);
      if (result.errors?.length) {
        console.error("Booking email errors:", result.errors);
      } else if (!result.sent && result.via === "none") {
        console.warn(
          "Booking emails skipped: connect a SpaceMail mailbox for this site, or set SMTP_* in Convex env"
        );
      }
      return result;
    } catch (error) {
      console.error("Failed to send booking emails:", error);
      return { sent: false, via: "none", errors: ["internal_send_failed"] };
    }
  },
});
