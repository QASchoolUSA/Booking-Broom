/**
 * Voip.ms booking confirmation SMS copy.
 * Hard-capped at 160 characters (Voip.ms / Messages UI limit).
 */

export const BOOKING_SMS_MAX = 160;

function firstName(customerName: string): string {
  const part = customerName.trim().split(/\s+/)[0] ?? "there";
  return part.slice(0, 24);
}

function formatShortDate(preferredDate?: string): string | null {
  if (!preferredDate?.trim()) return null;
  const raw = preferredDate.trim();
  // Prefer ISO YYYY-MM-DD → "Aug 20"
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    const date = new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
      12
    );
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  }
  return raw.slice(0, 12);
}

function clip(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  if (max <= 1) return trimmed.slice(0, max);
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Build a professional customer SMS that always fits in one segment (≤160).
 * Example: "Hi Jane, we got your Deep Cleaning request for Aug 20. We'll confirm soon. – Sanford Cleaning"
 */
export function buildCustomerBookingSms(args: {
  siteName: string;
  customerName: string;
  serviceType?: string;
  preferredDate?: string;
}): string {
  const name = firstName(args.customerName);
  const date = formatShortDate(args.preferredDate);
  const service = (args.serviceType ?? "cleaning").trim() || "cleaning";

  const build = (svc: string, site: string) => {
    const dateBit = date ? ` for ${date}` : "";
    return `Hi ${name}, we got your ${svc} request${dateBit}. We'll confirm soon. – ${site}`;
  };

  let message = build(service, args.siteName.trim() || "our team");
  if (message.length <= BOOKING_SMS_MAX) return message;

  // Shorten service, then site, until it fits.
  for (const serviceMax of [28, 18, 12, 8]) {
    for (const siteMax of [28, 18, 12, 8]) {
      message = build(clip(service, serviceMax), clip(args.siteName, siteMax));
      if (message.length <= BOOKING_SMS_MAX) return message;
    }
  }

  // Absolute fallback — drop date if still long.
  message = `Hi ${name}, we got your booking request. We'll confirm soon. – ${clip(args.siteName, 20)}`;
  return message.slice(0, BOOKING_SMS_MAX);
}
