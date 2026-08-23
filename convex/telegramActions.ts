import { internalAction, type ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { bookingIntent } from "./schema";

type NotifyResult =
  | { sent: true }
  | { sent: false; skipped: string };

const TELEGRAM_TIMEOUT_MS = 8_000;
const TELEGRAM_MAX_TEXT = 3900;

function appBaseUrl(): string {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://app.bookingbroom.com"
  ).replace(/\/$/, "");
}

/** Telegram HTML parse_mode requires these entities escaped in text nodes. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dash(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? escapeHtml(trimmed) : "—";
}

function formatMoney(estimate: number | undefined, currency: string | undefined) {
  if (estimate == null || !Number.isFinite(estimate)) return undefined;
  const code = (currency ?? "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(estimate);
  } catch {
    return `${estimate} ${code}`;
  }
}

function formatPreferred(date?: string, time?: string): string {
  const d = date?.trim();
  const t = time?.trim();
  if (d && t) return `${escapeHtml(d)} · ${escapeHtml(t)}`;
  if (d) return escapeHtml(d);
  if (t) return escapeHtml(t);
  return "—";
}

function digitsOnlyPhone(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return undefined;
}

function contactLine(email?: string, phone?: string): string {
  const parts: string[] = [];
  const emailTrim = email?.trim();
  if (emailTrim) {
    parts.push(
      `<a href="mailto:${escapeHtml(emailTrim)}">${escapeHtml(emailTrim)}</a>`,
    );
  }
  const phoneTrim = phone?.trim();
  if (phoneTrim) {
    const tel = digitsOnlyPhone(phoneTrim);
    parts.push(
      tel
        ? `<a href="tel:${escapeHtml(tel)}">${escapeHtml(phoneTrim)}</a>`
        : escapeHtml(phoneTrim),
    );
  }
  return parts.length > 0 ? parts.join("  ·  ") : "—";
}

function section(title: string, body: string): string {
  return `<b>${escapeHtml(title)}</b>\n${body}`;
}

/**
 * Professional HTML card for Telegram (parse_mode: HTML).
 * Keeps scanning easy in a busy chat: intent header, site, then labeled blocks.
 */
function buildTelegramHtml(args: {
  isQuote: boolean;
  siteName: string;
  siteSlug: string;
  customerName: string;
  email?: string;
  phone?: string;
  address?: string;
  serviceType?: string;
  preferredDate?: string;
  preferredTime?: string;
  notes?: string;
  quoteLine?: string;
}): string {
  const intentTitle = args.isQuote ? "Quote request" : "New booking";
  const service =
    (args.serviceType ?? "Cleaning").trim() || "Cleaning";

  const blocks: string[] = [
    `<b>${escapeHtml(intentTitle)}</b>`,
    `<i>${escapeHtml(args.siteName)}</i>`,
    `<code>${escapeHtml(args.siteSlug)}</code>`,
    "",
    section("Customer", dash(args.customerName)),
    section("Contact", contactLine(args.email, args.phone)),
    section("Address", dash(args.address)),
    section(
      "Service",
      `${escapeHtml(service)}\nPreferred: ${formatPreferred(args.preferredDate, args.preferredTime)}`,
    ),
  ];

  if (args.quoteLine) {
    blocks.push(section("Estimate", escapeHtml(args.quoteLine)));
  }

  const notes = args.notes?.trim();
  if (notes) {
    const clipped =
      notes.length > 800 ? `${notes.slice(0, 797)}…` : notes;
    blocks.push(section("Notes", escapeHtml(clipped)));
  }

  const text = blocks.join("\n\n");
  return text.length > TELEGRAM_MAX_TEXT
    ? `${text.slice(0, TELEGRAM_MAX_TEXT - 1)}…`
    : text;
}

async function notifyNewBookingHandler(
  ctx: ActionCtx,
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
    bookingId?: string;
  },
): Promise<NotifyResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    console.warn(
      "[telegram] skipped: set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Convex env",
    );
    return { sent: false, skipped: "env_missing" };
  }

  if (args.bookingId) {
    try {
      const claim = await ctx.runMutation(
        internal.bookings.claimTelegramNotifyInternal,
        { bookingId: args.bookingId as Id<"bookings"> },
      );
      if (!claim.claimed) {
        return { sent: false, skipped: `already_${claim.reason}` };
      }
    } catch (error) {
      console.error(
        "[telegram] claim failed:",
        error instanceof Error ? error.message : error,
      );
      // Continue without claim — better one duplicate than a silent miss.
    }
  }

  const site = await ctx.runQuery(internal.push.getSiteNameBySlugInternal, {
    slug: args.siteSlug,
  });
  const siteName = site?.name ?? args.siteSlug;
  const isQuote = args.intent === "quote";
  const money = formatMoney(args.quoteEstimate, args.quoteCurrency);
  const quoteLine = [money, args.quoteFrequency?.trim()]
    .filter(Boolean)
    .join(" · ");
  const bookingUrl = args.bookingId
    ? `${appBaseUrl()}/calendar?bookingId=${args.bookingId}`
    : `${appBaseUrl()}/`;

  const text = buildTelegramHtml({
    isQuote,
    siteName,
    siteSlug: args.siteSlug,
    customerName: args.customerName,
    email: args.email,
    phone: args.phone,
    address: args.address,
    serviceType: args.serviceType,
    preferredDate: args.preferredDate,
    preferredTime: args.preferredTime,
    notes: args.notes,
    quoteLine: quoteLine || undefined,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Open in Booking Broom",
                  url: bookingUrl,
                },
              ],
            ],
          },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(
        `[telegram] HTTP ${response.status}: ${body.slice(0, 200)}`,
      );
      return { sent: false, skipped: `http_${response.status}` };
    }

    return { sent: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Telegram send failed";
    console.error("[telegram] send error:", message);
    return { sent: false, skipped: "send_failed" };
  } finally {
    clearTimeout(timeout);
  }
}

const notifyArgs = {
  siteSlug: v.string(),
  customerName: v.string(),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  address: v.optional(v.string()),
  serviceType: v.optional(v.string()),
  preferredDate: v.optional(v.string()),
  preferredTime: v.optional(v.string()),
  notes: v.optional(v.string()),
  intent: v.optional(bookingIntent),
  quoteEstimate: v.optional(v.number()),
  quoteCurrency: v.optional(v.string()),
  quoteFrequency: v.optional(v.string()),
  bookingId: v.optional(v.string()),
};

/**
 * Best-effort Telegram alert for managers. Scheduled from createPublic so
 * marketing sites never wait on Telegram.
 */
export const notifyNewBookingInternal = internalAction({
  args: notifyArgs,
  handler: async (ctx, args): Promise<NotifyResult> => {
    try {
      return await notifyNewBookingHandler(ctx, args);
    } catch (error) {
      console.error(
        "[telegram] unexpected failure:",
        error instanceof Error ? error.message : error,
      );
      return { sent: false, skipped: "unexpected" };
    }
  },
});
