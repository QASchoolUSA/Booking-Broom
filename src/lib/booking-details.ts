import type { Booking, BookingProperty, BookingQuote } from "@/lib/types";
import { parseLegacyNotes } from "@/lib/parse-legacy-notes";

export interface ResolvedBookingDetails {
  property: BookingProperty | null;
  quote: BookingQuote | null;
  /** Notes with any recovered quote/property lines stripped out. */
  notes: string | null;
}

/**
 * Prefers the structured fields the sites now send, and falls back to parsing
 * the legacy prose in `notes` so older bookings render the same way.
 */
export function resolveBookingDetails(booking: Booking): ResolvedBookingDetails {
  const parsed =
    booking.quote && booking.property ? null : parseLegacyNotes(booking.notes);
  const recovered = Boolean(parsed?.quote || parsed?.property);

  return {
    property: booking.property ?? parsed?.property ?? null,
    quote: booking.quote ?? parsed?.quote ?? null,
    notes: recovered ? (parsed?.remainder ?? null) : booking.notes,
  };
}

export function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export function formatBedrooms(bedrooms: number) {
  return bedrooms === 0 ? "Studio" : String(bedrooms);
}

export function formatSquareFeet(squareFeet: number) {
  return `${squareFeet.toLocaleString("en-US")} sq ft`;
}

export function hasQuoteContent(quote: BookingQuote | null): quote is BookingQuote {
  if (!quote) return false;
  return (
    quote.estimate !== null ||
    quote.estimate_low !== null ||
    quote.estimate_high !== null ||
    Boolean(quote.service_level) ||
    Boolean(quote.frequency) ||
    Boolean(quote.add_ons?.length) ||
    Boolean(quote.payment_terms)
  );
}

export function hasPropertyContent(
  property: BookingProperty | null
): property is BookingProperty {
  if (!property) return false;
  return (
    property.bedrooms !== null ||
    property.bathrooms !== null ||
    property.square_feet !== null ||
    Boolean(property.size_label) ||
    Boolean(property.home_type)
  );
}
