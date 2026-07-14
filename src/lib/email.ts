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

function formatBookingDetails(payload: CreateBookingPayload): string {
  const lines = [
    `Name: ${payload.customer_name}`,
    payload.email ? `Email: ${payload.email}` : null,
    payload.phone ? `Phone: ${payload.phone}` : null,
    payload.address ? `Address: ${payload.address}` : null,
    payload.service_type ? `Service: ${payload.service_type}` : null,
    payload.preferred_date ? `Preferred date: ${payload.preferred_date}` : null,
    payload.preferred_time ? `Preferred time: ${payload.preferred_time}` : null,
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

/**
 * Send a one-off SMTP test to the site booking inbox (contact email).
 */
export async function sendSiteTestEmail(
  siteSlug: string
): Promise<{ sent: boolean; to?: string; error?: string }> {
  const transport = getTransport();
  if (!transport) {
    return {
      sent: false,
      error: "SMTP is not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS)",
    };
  }

  const to = getAdminEmail(siteSlug);
  if (!to) {
    return {
      sent: false,
      error: `No booking inbox email mapped for site "${siteSlug}"`,
    };
  }

  const siteName = getSiteDisplayName(siteSlug);
  const from = getFromAddress(siteSlug, siteName);

  try {
    await transport.sendMail({
      from,
      to,
      subject: `Booking Broom test — ${siteName}`,
      text: [
        `This is a test email from Booking Broom for ${siteName}.`,
        "",
        `Site slug: ${siteSlug}`,
        `Sent at: ${new Date().toISOString()}`,
        "",
        "If you received this, SMTP delivery for this site inbox is working.",
      ].join("\n"),
    });
    return { sent: true, to };
  } catch (err) {
    return {
      sent: false,
      to,
      error: err instanceof Error ? err.message : "Failed to send test email",
    };
  }
}
