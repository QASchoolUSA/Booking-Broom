/** Default SpaceMail IMAP/SMTP endpoints. */
export const SPACEMAIL_DEFAULTS = {
  imapHost: "mail.spacemail.com",
  imapPort: 993,
  smtpHost: "mail.spacemail.com",
  smtpPort: 465,
} as const;

/** Soft caps for initial / incremental sync. */
export const EMAIL_SYNC_LIMITS = {
  /** Max messages to fetch on a fresh sync (UIDVALIDITY reset). */
  maxInitialMessages: 500,
  /** Only consider messages newer than this on first sync. */
  initialLookbackMs: 90 * 24 * 60 * 60 * 1000,
  /** Max attachment bytes to store in Convex file storage. */
  maxAttachmentBytes: 5 * 1024 * 1024,
  /** Max messages to fetch per sync tick. */
  maxPerSyncBatch: 80,
} as const;

export function normalizeEmailAddress(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const angle = trimmed.match(/<([^>]+)>/);
  return (angle?.[1] ?? trimmed).trim();
}

export function normalizeMessageId(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw.trim().replace(/^<|>$/g, "").toLowerCase();
}

/** Strip Re:/Fwd: noise for fallback thread keys. */
export function normalizeSubject(subject: string): string {
  return subject
    .replace(/^\s*((re|fw|fwd|aw|sv|antw)\s*:\s*)+/gi, "")
    .trim()
    .toLowerCase();
}

/**
 * Prefer References root → In-Reply-To → subject+participants fallback.
 */
export function computeThreadKey(args: {
  messageId: string;
  inReplyTo?: string | null;
  references?: string[] | null;
  subject: string;
  participants: string[];
}): string {
  const refs = (args.references ?? [])
    .map(normalizeMessageId)
    .filter(Boolean);
  if (refs.length > 0) return `mid:${refs[0]}`;

  const inReplyTo = normalizeMessageId(args.inReplyTo);
  if (inReplyTo) return `mid:${inReplyTo}`;

  const mid = normalizeMessageId(args.messageId);
  if (mid) {
    // New root message — thread key is its own Message-ID.
    return `mid:${mid}`;
  }

  const people = [...new Set(args.participants.map(normalizeEmailAddress))]
    .filter(Boolean)
    .sort()
    .join(",");
  return `subj:${normalizeSubject(args.subject)}|${people}`;
}

export function snippetFromBodies(
  textBody?: string | null,
  htmlBody?: string | null
): string {
  const text =
    textBody?.replace(/\s+/g, " ").trim() ||
    htmlBody
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim() ||
    "";
  return text.slice(0, 160);
}
