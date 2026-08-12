/**
 * Booking confirmation / admin alert templates (plain text + HTML).
 * Kept in convex/ so Node actions don't import Next app paths.
 */

export type BookingEmailAudience = "customer" | "admin";

export type BookingEmailProperty = {
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  size_label?: string;
  home_type?: string;
  condition?: string;
  occupants?: number;
  last_cleaned?: string;
  excluded_areas?: string[];
};

export type BookingEmailQuoteAddOn = {
  label: string;
  price?: number;
  quantity?: number;
};

export type BookingEmailQuote = {
  estimate?: number;
  estimate_low?: number;
  estimate_high?: number;
  recurring_estimate?: number;
  currency?: string;
  service_level?: string;
  frequency?: string;
  add_ons?: BookingEmailQuoteAddOn[];
  payment_terms?: string;
  internal?: boolean;
};

export type BookingEmailPayload = {
  site_slug: string;
  customer_name: string;
  email?: string;
  phone?: string;
  address?: string;
  service_type?: string;
  preferred_date?: string;
  preferred_time?: string;
  notes?: string;
  property?: BookingEmailProperty;
  quote?: BookingEmailQuote;
};

export type BookingEmailContent = {
  subject: string;
  text: string;
  html: string;
};

/** Email-client-safe faces (web fonts often fail in inbox clients). */
const FONT_DISPLAY = "Georgia,'Times New Roman',Times,serif";
const FONT_BODY = "Verdana,Tahoma,Geneva,sans-serif";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

function formatPropertyParts(
  property: BookingEmailProperty | undefined
): string[] {
  if (!property) return [];

  return [
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
    property.condition ? `Condition: ${property.condition}` : null,
    property.occupants !== undefined
      ? `${property.occupants} occupant${property.occupants === 1 ? "" : "s"}`
      : null,
    property.last_cleaned ? `Last cleaned: ${property.last_cleaned}` : null,
    property.excluded_areas?.length
      ? `Excluded: ${property.excluded_areas.join(", ")}`
      : null,
  ].filter((part): part is string => Boolean(part));
}

function formatPropertyBlock(
  property: BookingEmailProperty | undefined
): string | null {
  const parts = formatPropertyParts(property);
  return parts.length ? `Property: ${parts.join(" · ")}` : null;
}

function formatQuoteLines(
  quote: BookingEmailQuote | undefined,
  audience: BookingEmailAudience
): Array<{ label: string; value: string }> {
  if (!quote) return [];
  if (quote.internal && audience === "customer") return [];

  const currency = quote.currency ?? "USD";
  const hasRange =
    quote.estimate_low !== undefined && quote.estimate_high !== undefined;
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

  const rows: Array<{ label: string; value: string }> = [];
  if (quote.service_level) {
    rows.push({ label: "Service level", value: quote.service_level });
  }
  if (quote.frequency) {
    rows.push({ label: "Frequency", value: quote.frequency });
  }
  if (quote.add_ons?.length) {
    rows.push({
      label: "Add-ons",
      value: quote.add_ons
        .map((addOn) =>
          addOn.price !== undefined
            ? `${addOn.label} (+${formatMoney(addOn.price, currency)})`
            : addOn.label
        )
        .join(", "),
    });
  }
  if (estimate) {
    rows.push({
      label:
        quote.recurring_estimate !== undefined
          ? "Initial clean"
          : "Estimated total",
      value: estimate,
    });
  }
  if (quote.recurring_estimate !== undefined) {
    rows.push({
      label: "Recurring price",
      value: formatMoney(quote.recurring_estimate, currency),
    });
  }
  if (quote.payment_terms) {
    rows.push({ label: "Payment", value: quote.payment_terms });
  }
  return rows;
}

function formatQuoteBlock(
  quote: BookingEmailQuote | undefined,
  audience: BookingEmailAudience
): string[] {
  return formatQuoteLines(quote, audience).map(
    (row) => `${row.label}: ${row.value}`
  );
}

function detailRows(
  payload: BookingEmailPayload,
  audience: BookingEmailAudience
): Array<{ label: string; value: string }> {
  const propertyParts = formatPropertyParts(payload.property);
  const rows: Array<{ label: string; value: string }> = [
    { label: "Name", value: payload.customer_name },
  ];
  if (payload.email) rows.push({ label: "Email", value: payload.email });
  if (payload.phone) rows.push({ label: "Phone", value: payload.phone });
  if (payload.address) rows.push({ label: "Address", value: payload.address });
  if (payload.service_type) {
    rows.push({ label: "Service", value: payload.service_type });
  }
  if (propertyParts.length) {
    rows.push({ label: "Property", value: propertyParts.join(" · ") });
  }
  if (payload.preferred_date) {
    rows.push({ label: "Preferred date", value: payload.preferred_date });
  }
  if (payload.preferred_time) {
    rows.push({ label: "Preferred time", value: payload.preferred_time });
  }
  rows.push(...formatQuoteLines(payload.quote, audience));
  if (payload.notes) rows.push({ label: "Notes", value: payload.notes });
  return rows;
}

function formatBookingDetails(
  payload: BookingEmailPayload,
  audience: BookingEmailAudience
): string {
  const lines = [
    `Name: ${payload.customer_name}`,
    payload.email ? `Email: ${payload.email}` : null,
    payload.phone ? `Phone: ${payload.phone}` : null,
    payload.address ? `Address: ${payload.address}` : null,
    payload.service_type ? `Service: ${payload.service_type}` : null,
    formatPropertyBlock(payload.property),
    payload.preferred_date ? `Preferred date: ${payload.preferred_date}` : null,
    payload.preferred_time ? `Preferred time: ${payload.preferred_time}` : null,
    ...formatQuoteBlock(payload.quote, audience),
    payload.notes ? `\nNotes:\n${payload.notes}` : null,
  ].filter(Boolean);

  return lines.join("\n");
}

function normalizeAccent(accentColor?: string): string {
  if (accentColor && /^#[0-9A-Fa-f]{6}$/.test(accentColor)) {
    return accentColor;
  }
  return "#0f766e";
}

function renderDetailTable(
  rows: Array<{ label: string; value: string }>
): string {
  return rows
    .map(
      (row, index) => `
      <tr>
        <td style="padding:12px 0;${index === 0 ? "" : "border-top:1px solid #e5e7eb;"}vertical-align:top;width:34%;font-size:13px;line-height:20px;color:#6b7280;font-family:${FONT_BODY};">
          ${escapeHtml(row.label)}
        </td>
        <td style="padding:12px 0;${index === 0 ? "" : "border-top:1px solid #e5e7eb;"}vertical-align:top;font-size:14px;line-height:21px;color:#111827;font-family:${FONT_BODY};font-weight:600;">
          ${escapeHtml(row.value).replace(/\n/g, "<br />")}
        </td>
      </tr>`
    )
    .join("");
}

function wrapBookingHtml(args: {
  siteName: string;
  accentColor?: string;
  eyebrow: string;
  title: string;
  intro: string;
  rows: Array<{ label: string; value: string }>;
  callout?: string;
  footerNote: string;
}): string {
  const accent = normalizeAccent(args.accentColor);
  const safeSite = escapeHtml(args.siteName);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(args.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:${accent};padding:28px 32px;">
              <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.85);font-family:${FONT_BODY};">
                ${escapeHtml(args.eyebrow)}
              </p>
              <h1 style="margin:0;font-size:26px;line-height:34px;color:#ffffff;font-family:${FONT_DISPLAY};font-weight:700;">
                ${safeSite}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 12px 0;font-size:22px;line-height:30px;color:#111827;font-family:${FONT_DISPLAY};">
                ${escapeHtml(args.title)}
              </h2>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:24px;color:#374151;font-family:${FONT_BODY};">
                ${escapeHtml(args.intro)}
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;padding:4px 18px;background:#fafafa;">
                ${renderDetailTable(args.rows)}
              </table>
              ${
                args.callout
                  ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr>
                  <td style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:14px 16px;font-size:14px;line-height:22px;color:#065f46;font-family:${FONT_BODY};">
                    ${escapeHtml(args.callout)}
                  </td>
                </tr>
              </table>`
                  : ""
              }
              <p style="margin:24px 0 0 0;font-size:14px;line-height:22px;color:#4b5563;font-family:${FONT_BODY};">
                ${escapeHtml(args.footerNote)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px 32px;border-top:1px solid #e5e7eb;background:#f9fafb;">
              <p style="margin:0;font-size:12px;line-height:18px;color:#9ca3af;font-family:${FONT_BODY};">
                ${safeSite} · Professional residential &amp; commercial cleaning
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildCustomerBookingEmail(
  siteName: string,
  payload: BookingEmailPayload,
  options?: { accentColor?: string }
): BookingEmailContent {
  const rows = detailRows(payload, "customer");
  const text = [
    `Hi ${payload.customer_name},`,
    "",
    `Thank you for booking with ${siteName}! We've received your request and will confirm your appointment shortly.`,
    "",
    "Your booking details:",
    "",
    formatBookingDetails(payload, "customer"),
    "",
    "Payment is due after your cleaning is complete — no upfront payment required.",
    "",
    `Questions? Reply to this email or call us.`,
    "",
    siteName,
  ].join("\n");

  return {
    subject: `Booking request received — ${siteName}`,
    text,
    html: wrapBookingHtml({
      siteName,
      accentColor: options?.accentColor,
      eyebrow: "Booking confirmation",
      title: "We've received your request",
      intro: `Hi ${payload.customer_name}, thank you for choosing ${siteName}. Your booking details are below — our team will confirm your appointment shortly.`,
      rows,
      callout:
        "Payment is due after your cleaning is complete — no upfront payment required.",
      footerNote: "Questions? Reply to this email or call us anytime.",
    }),
  };
}

export function buildAdminBookingEmail(
  siteName: string,
  payload: BookingEmailPayload,
  options?: { accentColor?: string }
): BookingEmailContent {
  const rows = detailRows(payload, "admin");
  const text = [
    `New booking received via ${siteName} (${payload.site_slug})`,
    "",
    formatBookingDetails(payload, "admin"),
  ].join("\n");

  return {
    subject: `New booking — ${payload.customer_name}`,
    text,
    html: wrapBookingHtml({
      siteName,
      accentColor: options?.accentColor,
      eyebrow: "New booking alert",
      title: "New booking received",
      intro: `A new booking came in via ${siteName} (${payload.site_slug}).`,
      rows,
      footerNote: "Reply to this email to contact the customer directly.",
    }),
  };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
