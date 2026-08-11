/**
 * Plain-text booking confirmation / admin alert templates.
 * Kept in convex/ so Node actions don't import Next app paths.
 */

export type BookingEmailAudience = "customer" | "admin";

export type BookingEmailProperty = {
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  size_label?: string;
  home_type?: string;
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

function formatMoney(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

function formatPropertyBlock(
  property: BookingEmailProperty | undefined
): string | null {
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

function formatQuoteBlock(
  quote: BookingEmailQuote | undefined,
  audience: BookingEmailAudience
): string[] {
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
    estimate
      ? `${quote.recurring_estimate !== undefined ? "Initial clean" : "Estimated total"}: ${estimate}`
      : null,
    quote.recurring_estimate !== undefined
      ? `Recurring price: ${formatMoney(quote.recurring_estimate, currency)}`
      : null,
    quote.payment_terms ? `Payment: ${quote.payment_terms}` : null,
  ].filter((line): line is string => Boolean(line));
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

export function buildCustomerBookingEmail(
  siteName: string,
  payload: BookingEmailPayload
): { subject: string; text: string } {
  return {
    subject: `Booking request received — ${siteName}`,
    text: [
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
    ].join("\n"),
  };
}

export function buildAdminBookingEmail(
  siteName: string,
  payload: BookingEmailPayload
): { subject: string; text: string } {
  return {
    subject: `New booking — ${payload.customer_name}`,
    text: [
      `New booking received via ${siteName} (${payload.site_slug})`,
      "",
      formatBookingDetails(payload, "admin"),
    ].join("\n"),
  };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
