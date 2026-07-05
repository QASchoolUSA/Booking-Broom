import nodemailer from "nodemailer";
import type { CreateBookingPayload } from "@/lib/types";
import { getAdminEmail, getSiteDisplayName } from "@/lib/site-emails";

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

function getFromAddress(siteName: string): string {
  return process.env.SMTP_FROM ?? `${siteName} <${process.env.SMTP_USER ?? "noreply@example.com"}>`;
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
  const from = getFromAddress(siteName);
  const errors: string[] = [];

  if (payload.email && isValidEmail(payload.email)) {
    const { subject, text } = buildCustomerEmail(siteName, payload);
    try {
      await transport.sendMail({ from, to: payload.email.trim(), subject, text });
    } catch (err) {
      errors.push(`Customer email failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  const adminEmail = getAdminEmail(payload.site_slug) ?? process.env.SMTP_USER;
  if (adminEmail) {
    const { subject, text } = buildAdminEmail(siteName, payload);
    try {
      await transport.sendMail({ from, to: adminEmail, subject, text });
    } catch (err) {
      errors.push(`Admin email failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return { sent: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
}
