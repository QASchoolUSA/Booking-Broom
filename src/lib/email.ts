import nodemailer from "nodemailer";
import type { CreateBookingPayload } from "@/lib/types";
import {
  getAdminEmail,
  getSiteDisplayName,
  getSiteFromAddress,
} from "@/lib/site-emails";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function getTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT ?? 465);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Prefer the cleaning site's own From address so Sanford bookings come from
 * Sanford Cleaning, etc. Fall back to SMTP_FROM / SMTP_USER only when the
 * site slug is unknown.
 */
function getFromAddress(siteSlug: string, siteName: string): string {
  return (
    getSiteFromAddress(siteSlug) ??
    process.env.SMTP_FROM ??
    `${siteName} <${process.env.SMTP_USER ?? "noreply@example.com"}>`
  );
}

function formatMoney(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

function formatPropertyBlock(payload: CreateBookingPayload): string | null {
  const property = payload.property;
  if (!property) return null;

  const parts = [
    property.bedrooms !== undefined
      ? property.bedrooms === 0
        ? "Studio"
        : `${property.bedrooms} bedroom${property.bedrooms === 1 ? "" : "s"}`
      : null,
    property.bathrooms !== undefined
      ? `${property.bathrooms} bathroom${property.bathrooms === 1 ? "" : "s"}`
      : null,
    property.square_feet !== undefined
      ? `${property.square_feet.toLocaleString("en-US")} sq ft`
      : property.size_label ?? null,
    property.home_type ?? null,
  ].filter(Boolean);

  return parts.length ? `Property: ${parts.join(" · ")}` : null;
}

function formatQuoteBlock(payload: CreateBookingPayload): string[] {
  const quote = payload.quote;
  if (!quote) return [];

  const currency = quote.currency ?? "USD";
  const hasRange = quote.estimate_low !== undefined && quote.estimate_high !== undefined;
  const estimate =
    quote.estimate !== undefined
      ? `${formatMoney(quote.estimate, currency)}${
          hasRange
            ? ` (range ${formatMoney(quote.estimate_low!, currency)}–${formatMoney(quote.estimate_high!, currency)})`
            : ""
        }`
      : hasRange
        ? `${formatMoney(quote.estimate_low!, currency)}–${formatMoney(quote.estimate_high!, currency)}`
        : null;

  return [
    quote.service_level ? `Service level: ${quote.service_level}` : null,
    quote.frequency ? `Frequency: ${quote.frequency}` : null,
    quote.add_ons?.length
      ? `Add-ons: ${quote.add_ons
          .map((addOn) =>
            addOn.price !== undefined
              ? `${addOn.label} (+${formatMoney(addOn.price, currency)})`
              : addOn.label
          )
          .join(", ")}`
      : null,
    estimate ? `Estimated total: ${estimate}` : null,
    quote.payment_terms ? `Payment: ${quote.payment_terms}` : null,
  ].filter((line): line is string => Boolean(line));
}

function formatBookingDetails(payload: CreateBookingPayload): string {
  const lines = [
    `Name: ${payload.customer_name}`,
    payload.email ? `Email: ${payload.email}` : null,
    payload.phone ? `Phone: ${payload.phone}` : null,
    payload.address ? `Address: ${payload.address}` : null,
    payload.service_type ? `Service: ${payload.service_type}` : null,
    formatPropertyBlock(payload),
    payload.preferred_date ? `Preferred date: ${payload.preferred_date}` : null,
    payload.preferred_time ? `Preferred time: ${payload.preferred_time}` : null,
    ...formatQuoteBlock(payload),
    payload.notes ? `\nNotes:\n${payload.notes}` : null,
  ].filter(Boolean);

  return lines.join("\n");
}

function buildCustomerEmail(siteName: string, payload: CreateBookingPayload): { subject: string; text: string } {
  return {
    subject: `Booking request received — ${siteName}`,
    text: [
      `Hi ${payload.customer_name},`,
      "",
      `Thank you for booking with ${siteName}! We've received your request and will confirm your appointment shortly.`,
      "",
      "Your booking details:",
      "",
      formatBookingDetails(payload),
      "",
      "Payment is due after your cleaning is complete — no upfront payment required.",
      "",
      `Questions? Reply to this email or call us.`,
      "",
      siteName,
    ].join("\n"),
  };
}

function buildAdminEmail(siteName: string, payload: CreateBookingPayload): { subject: string; text: string } {
  return {
    subject: `New booking — ${payload.customer_name}`,
    text: [
      `New booking received via ${siteName} (${payload.site_slug})`,
      "",
      formatBookingDetails(payload),
    ].join("\n"),
  };
}

export async function sendBookingEmails(
  payload: CreateBookingPayload
): Promise<{ sent: boolean; errors?: string[] }> {
  const transport = getTransport();
  if (!transport) {
    return { sent: false };
  }

  const siteName = getSiteDisplayName(payload.site_slug);
  const from = getFromAddress(payload.site_slug, siteName);
  const replyTo = getAdminEmail(payload.site_slug);
  const errors: string[] = [];

  if (payload.email && isValidEmail(payload.email)) {
    const { subject, text } = buildCustomerEmail(siteName, payload);
    try {
      await transport.sendMail({
        from,
        to: payload.email.trim(),
        replyTo,
        subject,
        text,
      });
    } catch (err) {
      errors.push(`Customer email failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  const adminEmail = getAdminEmail(payload.site_slug) ?? process.env.SMTP_USER;
  if (adminEmail) {
    const { subject, text } = buildAdminEmail(siteName, payload);
    try {
      await transport.sendMail({
        from,
        to: adminEmail,
        replyTo: payload.email && isValidEmail(payload.email) ? payload.email.trim() : undefined,
        subject,
        text,
      });
    } catch (err) {
      errors.push(`Admin email failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return { sent: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
}
