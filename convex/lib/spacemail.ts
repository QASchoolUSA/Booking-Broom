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
  /**
   * Convex docs max ~1 MiB. Keep bodies well under so headers + meta fit.
   * Measured in JS string length (≈ UTF-16 units); good enough as a soft cap.
   */
  maxHtmlChars: 350_000,
  maxTextChars: 80_000,
} as const;

const TRUNCATION_NOTE =
  "\n\n[Message truncated — open in SpaceMail webmail for the full body]";

/** Clamp a body so emailMessages documents stay under Convex's 1 MiB limit. */
export function clampEmailBody(
  value: string | undefined | null,
  maxChars: number
): string | undefined {
  if (!value) return undefined;
  if (value.length <= maxChars) return value;
  const keep = Math.max(0, maxChars - TRUNCATION_NOTE.length);
  return value.slice(0, keep) + TRUNCATION_NOTE;
}

export function clampMessageBodies(args: {
  textBody?: string;
  htmlBody?: string;
}): { textBody?: string; htmlBody?: string } {
  let textBody = clampEmailBody(
    args.textBody,
    EMAIL_SYNC_LIMITS.maxTextChars
  );
  let htmlBody = clampEmailBody(
    args.htmlBody,
    EMAIL_SYNC_LIMITS.maxHtmlChars
  );

  // If HTML is still huge somehow, drop it and keep text only.
  const approx =
    (textBody?.length ?? 0) + (htmlBody?.length ?? 0);
  if (approx > 700_000) {
    htmlBody = undefined;
    textBody =
      textBody ??
      clampEmailBody(
        args.htmlBody?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "),
        EMAIL_SYNC_LIMITS.maxTextChars
      );
  }

  return { textBody, htmlBody };
}

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
