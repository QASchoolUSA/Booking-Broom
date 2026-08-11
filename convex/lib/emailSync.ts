"use node";

import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail, type Attachment } from "mailparser";
import nodemailer from "nodemailer";
import {
  EMAIL_SYNC_LIMITS,
  SPACEMAIL_DEFAULTS,
  computeThreadKey,
  normalizeEmailAddress,
  normalizeMessageId,
  snippetFromBodies,
} from "./spacemail";

export type MailboxConn = {
  email: string;
  password: string;
  imapHost?: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
};

export type ParsedAttachmentMeta = {
  filename: string;
  size: number;
  contentType: string;
  /** Raw bytes when under size cap; caller stores to Convex. */
  content?: Buffer;
  skipped?: boolean;
};

export type ParsedInboundMessage = {
  uid: number;
  messageId: string;
  inReplyTo?: string;
  references?: string[];
  direction: "in" | "out";
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  textBody?: string;
  htmlBody?: string;
  sentAt: number;
  seen: boolean;
  answered: boolean;
  threadKey: string;
  snippet: string;
  participants: string[];
  attachments: ParsedAttachmentMeta[];
};

function addressList(
  value: ParsedMail["from"] | ParsedMail["to"] | ParsedMail["cc"]
): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const group of list) {
    for (const addr of group.value ?? []) {
      if (addr.address) out.push(normalizeEmailAddress(addr.address));
    }
  }
  return out;
}

function formatFrom(value: ParsedMail["from"]): string {
  if (!value?.value?.[0]) return "";
  const a = value.value[0];
  if (a.name && a.address) return `${a.name} <${a.address}>`;
  return a.address ?? a.name ?? "";
}

function mapAttachments(atts: Attachment[] | undefined): ParsedAttachmentMeta[] {
  if (!atts?.length) return [];
  return atts.map((att) => {
    const filename = att.filename || "attachment";
    const size = att.size ?? att.content?.length ?? 0;
    const contentType = att.contentType || "application/octet-stream";
    if (size > EMAIL_SYNC_LIMITS.maxAttachmentBytes || !att.content) {
      return { filename, size, contentType, skipped: true };
    }
    const content = Buffer.isBuffer(att.content)
      ? att.content
      : Buffer.from(att.content);
    return { filename, size, contentType, content };
  });
}

export function parseMailToInbound(
  uid: number,
  parsed: ParsedMail,
  mailboxEmail: string,
  flags: Set<string>
): ParsedInboundMessage {
  const messageId =
    normalizeMessageId(parsed.messageId) ||
    `uid-${uid}@${normalizeEmailAddress(mailboxEmail)}`;
  const inReplyTo = normalizeMessageId(parsed.inReplyTo) || undefined;
  const references = (parsed.references
    ? Array.isArray(parsed.references)
      ? parsed.references
      : [parsed.references]
    : []
  )
    .map(normalizeMessageId)
    .filter(Boolean);

  const from = formatFrom(parsed.from) || "unknown";
  const to = addressList(parsed.to);
  const cc = addressList(parsed.cc);
  const subject = parsed.subject?.trim() || "(no subject)";
  const textBody = parsed.text?.trim() || undefined;
  const htmlBody = parsed.html
    ? typeof parsed.html === "string"
      ? parsed.html
      : undefined
    : undefined;
  const sentAt = parsed.date?.getTime() ?? Date.now();
  const seen = flags.has("\\Seen") || flags.has("Seen");
  const answered = flags.has("\\Answered") || flags.has("Answered");

  const mailboxNorm = normalizeEmailAddress(mailboxEmail);
  const fromNorm = normalizeEmailAddress(from);
  const direction: "in" | "out" = fromNorm === mailboxNorm ? "out" : "in";

  const participants = [
    ...new Set([fromNorm, ...to, ...cc].filter(Boolean)),
  ];

  const threadKey = computeThreadKey({
    messageId,
    inReplyTo,
    references,
    subject,
    participants,
  });

  return {
    uid,
    messageId,
    inReplyTo,
    references: references.length ? references : undefined,
    direction,
    from,
    to,
    cc,
    subject,
    textBody,
    htmlBody,
    sentAt,
    seen,
    answered,
    threadKey,
    snippet: snippetFromBodies(textBody, htmlBody),
    participants,
    attachments: mapAttachments(parsed.attachments),
  };
}

export function createImapClient(conn: MailboxConn): ImapFlow {
  return new ImapFlow({
    host: conn.imapHost ?? SPACEMAIL_DEFAULTS.imapHost,
    port: conn.imapPort ?? SPACEMAIL_DEFAULTS.imapPort,
    secure: true,
    auth: {
      user: conn.email,
      pass: conn.password,
    },
    logger: false,
  });
}

export async function testImapSmtp(conn: MailboxConn): Promise<void> {
  const client = createImapClient(conn);
  try {
    await client.connect();
    await client.mailboxOpen("INBOX");
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore
    }
  }

  const transport = nodemailer.createTransport({
    host: conn.smtpHost ?? SPACEMAIL_DEFAULTS.smtpHost,
    port: conn.smtpPort ?? SPACEMAIL_DEFAULTS.smtpPort,
    secure: (conn.smtpPort ?? SPACEMAIL_DEFAULTS.smtpPort) === 465,
    auth: {
      user: conn.email,
      pass: conn.password,
    },
  });
  await transport.verify();
}

export type SyncFetchResult = {
  uidValidity: number;
  lastUid: number;
  messages: ParsedInboundMessage[];
  reset: boolean;
};

/**
 * Incremental INBOX fetch. If uidValidity changes vs stored, resets and
 * fetches recent messages (lookback / maxInitialMessages).
 */
export async function fetchInboxIncremental(
  conn: MailboxConn,
  stored: { uidValidity?: number; lastUid?: number }
): Promise<SyncFetchResult> {
  const client = createImapClient(conn);
  const messages: ParsedInboundMessage[] = [];
  let uidValidity = 0;
  let lastUid = stored.lastUid ?? 0;
  let reset = false;

  try {
    await client.connect();
    const lock = await client.mailboxOpen("INBOX");
    uidValidity = Number(lock.uidValidity);
    const exists = lock.exists ?? 0;

    if (stored.uidValidity && stored.uidValidity !== uidValidity) {
      reset = true;
      lastUid = 0;
    }

    if (exists === 0) {
      return { uidValidity, lastUid: 0, messages: [], reset };
    }

    let uids: number[] = [];

    if (!lastUid || reset) {
      // Fresh sync: last N by UID, then filter by lookback date when parsing.
      const start = Math.max(1, exists - EMAIL_SYNC_LIMITS.maxInitialMessages + 1);
      // Prefer UID search for all; fall back to sequence.
      try {
        const allUids = await client.search({ all: true }, { uid: true });
        const list = Array.isArray(allUids) ? allUids.map(Number) : [];
        uids = list.slice(-EMAIL_SYNC_LIMITS.maxInitialMessages);
      } catch {
        // sequence range as fallback — fetch by seq then use uid from envelope
        const range = `${start}:*`;
        for await (const msg of client.fetch(range, {
          uid: true,
          flags: true,
          source: true,
        })) {
          if (msg.source) {
            const parsed = await simpleParser(msg.source);
            const cutoff =
              Date.now() - EMAIL_SYNC_LIMITS.initialLookbackMs;
            if ((parsed.date?.getTime() ?? 0) < cutoff && !reset) {
              // still allow on reset path below
            }
            const flags = new Set(
              [...(msg.flags ?? [])].map((f) => String(f))
            );
            messages.push(
              parseMailToInbound(msg.uid, parsed, conn.email, flags)
            );
          }
          lastUid = Math.max(lastUid, msg.uid);
        }
        // Filter lookback for initial
        const cutoff = Date.now() - EMAIL_SYNC_LIMITS.initialLookbackMs;
        const filtered = messages.filter((m) => m.sentAt >= cutoff);
        const keep =
          filtered.length > 0
            ? filtered.slice(-EMAIL_SYNC_LIMITS.maxInitialMessages)
            : messages.slice(-EMAIL_SYNC_LIMITS.maxInitialMessages);
        return {
          uidValidity,
          lastUid,
          messages: keep,
          reset,
        };
      }
    } else {
      const found = await client.search(
        { uid: `${lastUid + 1}:*` },
        { uid: true }
      );
      uids = (Array.isArray(found) ? found : []).map(Number).filter((u) => u > lastUid);
    }

    // Cap batch size for cron friendliness
    if (uids.length > EMAIL_SYNC_LIMITS.maxPerSyncBatch) {
      uids = uids.slice(0, EMAIL_SYNC_LIMITS.maxPerSyncBatch);
    }

    if (uids.length === 0) {
      return { uidValidity, lastUid, messages: [], reset };
    }

    const uidRange = uids.join(",");
    const cutoff = Date.now() - EMAIL_SYNC_LIMITS.initialLookbackMs;

    for await (const msg of client.fetch(
      uidRange,
      { uid: true, flags: true, source: true },
      { uid: true }
    )) {
      if (!msg.source) continue;
      const parsed = await simpleParser(msg.source);
      if ((!stored.lastUid || reset) && (parsed.date?.getTime() ?? 0) < cutoff) {
        lastUid = Math.max(lastUid, msg.uid);
        continue;
      }
      const flags = new Set([...(msg.flags ?? [])].map((f) => String(f)));
      messages.push(parseMailToInbound(msg.uid, parsed, conn.email, flags));
      lastUid = Math.max(lastUid, msg.uid);
    }

    return { uidValidity, lastUid, messages, reset };
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore
    }
  }
}

export async function markImapSeen(
  conn: MailboxConn,
  uids: number[]
): Promise<void> {
  if (uids.length === 0) return;
  const client = createImapClient(conn);
  try {
    await client.connect();
    await client.mailboxOpen("INBOX");
    await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore
    }
  }
}

export async function sendSmtpMail(args: {
  conn: MailboxConn;
  fromName?: string;
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string;
  references?: string[];
}): Promise<{ messageId: string }> {
  const transport = nodemailer.createTransport({
    host: args.conn.smtpHost ?? SPACEMAIL_DEFAULTS.smtpHost,
    port: args.conn.smtpPort ?? SPACEMAIL_DEFAULTS.smtpPort,
    secure:
      (args.conn.smtpPort ?? SPACEMAIL_DEFAULTS.smtpPort) === 465,
    auth: {
      user: args.conn.email,
      pass: args.conn.password,
    },
  });

  const from = args.fromName
    ? `${args.fromName} <${args.conn.email}>`
    : args.conn.email;

  const info = await transport.sendMail({
    from,
    to: args.to.join(", "),
    cc: args.cc?.length ? args.cc.join(", ") : undefined,
    subject: args.subject,
    text: args.text,
    html: args.html,
    inReplyTo: args.inReplyTo
      ? `<${normalizeMessageId(args.inReplyTo)}>`
      : undefined,
    references: args.references?.length
      ? args.references.map((r) => `<${normalizeMessageId(r)}>`).join(" ")
      : undefined,
  });

  const messageId =
    normalizeMessageId(info.messageId) ||
    `out-${Date.now()}@${normalizeEmailAddress(args.conn.email)}`;

  return { messageId };
}

/** Best-effort APPEND to Sent. Never throws to caller — logs via return. */
export async function appendToSent(
  conn: MailboxConn,
  raw: string
): Promise<{ ok: boolean; error?: string }> {
  const client = createImapClient(conn);
  try {
    await client.connect();
    // Common Sent folder names across SpaceMail / Dovecot
    const candidates = ["Sent", "INBOX.Sent", "Sent Messages", "Sent Items"];
    let path: string | null = null;
    const boxes = await client.list();
    const paths = new Set(boxes.map((b) => b.path));
    for (const c of candidates) {
      if (paths.has(c)) {
        path = c;
        break;
      }
    }
    if (!path) {
      // try special-use \Sent
      const sent = boxes.find((b) =>
        (b.specialUse || "").toLowerCase().includes("sent")
      );
      path = sent?.path ?? null;
    }
    if (!path) return { ok: false, error: "No Sent folder found" };
    await client.append(path, raw, ["\\Seen"]);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "APPEND failed",
    };
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore
    }
  }
}

export function buildRawMime(args: {
  from: string;
  to: string[];
  subject: string;
  text: string;
  messageId: string;
  inReplyTo?: string;
  references?: string[];
}): string {
  const mid = `<${normalizeMessageId(args.messageId)}>`;
  const headers = [
    `From: ${args.from}`,
    `To: ${args.to.join(", ")}`,
    `Subject: ${args.subject}`,
    `Message-ID: ${mid}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: 8bit",
  ];
  if (args.inReplyTo) {
    headers.push(`In-Reply-To: <${normalizeMessageId(args.inReplyTo)}>`);
  }
  if (args.references?.length) {
    headers.push(
      `References: ${args.references
        .map((r) => `<${normalizeMessageId(r)}>`)
        .join(" ")}`
    );
  }
  return `${headers.join("\r\n")}\r\n\r\n${args.text}`;
}
