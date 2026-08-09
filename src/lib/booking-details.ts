import type {
  Booking,
  BookingAttribution,
  BookingIntent,
  BookingProperty,
  BookingQuote,
} from "@/lib/types";
import { parseLegacyNotes } from "@/lib/parse-legacy-notes";

export interface ResolvedBookingDetails {
  property: BookingProperty | null;
  quote: BookingQuote | null;
  attribution: BookingAttribution | null;
  intent: BookingIntent | null;
  /** Notes with any recovered quote/property lines stripped out. */
  notes: string | null;
}

function pick<T>(structured: T | null, recovered: T | null | undefined): T | null {
  return structured ?? recovered ?? null;
}

function mergeProperty(
  structured: BookingProperty | null,
  recovered: BookingProperty | null
): BookingProperty | null {
  if (!structured) return recovered;
  if (!recovered) return structured;

  return {
    bedrooms: pick(structured.bedrooms, recovered.bedrooms),
    bathrooms: pick(structured.bathrooms, recovered.bathrooms),
    square_feet: pick(structured.square_feet, recovered.square_feet),
    size_label: pick(structured.size_label, recovered.size_label),
    home_type: pick(structured.home_type, recovered.home_type),
    condition: pick(structured.condition, recovered.condition),
    occupants: pick(structured.occupants, recovered.occupants),
    last_cleaned: pick(structured.last_cleaned, recovered.last_cleaned),
    excluded_areas: structured.excluded_areas?.length
      ? structured.excluded_areas
      : recovered.excluded_areas,
  };
}

function mergeQuote(
  structured: BookingQuote | null,
  recovered: BookingQuote | null
): BookingQuote | null {
  if (!structured) return recovered;
  if (!recovered) return structured;

  return {
    estimate: pick(structured.estimate, recovered.estimate),
    estimate_low: pick(structured.estimate_low, recovered.estimate_low),
    estimate_high: pick(structured.estimate_high, recovered.estimate_high),
    recurring_estimate: pick(
      structured.recurring_estimate,
      recovered.recurring_estimate
    ),
    currency: structured.currency || recovered.currency || "USD",
    service_level: pick(structured.service_level, recovered.service_level),
    frequency: pick(structured.frequency, recovered.frequency),
    add_ons: structured.add_ons?.length ? structured.add_ons : recovered.add_ons,
    payment_terms: pick(structured.payment_terms, recovered.payment_terms),
    internal: structured.internal || recovered.internal,
  };
}

function mergeAttribution(
  structured: BookingAttribution | null,
  recovered: BookingAttribution | null
): BookingAttribution | null {
  if (!structured) return recovered;
  if (!recovered) return structured;

  return {
    utm_source: pick(structured.utm_source, recovered.utm_source),
    utm_medium: pick(structured.utm_medium, recovered.utm_medium),
    utm_campaign: pick(structured.utm_campaign, recovered.utm_campaign),
    utm_term: pick(structured.utm_term, recovered.utm_term),
    utm_content: pick(structured.utm_content, recovered.utm_content),
    gclid: pick(structured.gclid, recovered.gclid),
  };
}

/**
 * Sites send structured fields inconsistently: some omit `quote` entirely, others
 * send only part of it and repeat the rest as prose in `notes`. So always parse
 * `notes` too and fill each field the structured payload left empty, which also
 * keeps recovered lines from being displayed twice.
 */
export function resolveBookingDetails(booking: Booking): ResolvedBookingDetails {
  const parsed = parseLegacyNotes(booking.notes);
  const recovered = Boolean(
    parsed.quote || parsed.property || parsed.intent || parsed.attribution
  );

  return {
    property: mergeProperty(booking.property, parsed.property),
    quote: mergeQuote(booking.quote, parsed.quote),
    attribution: mergeAttribution(booking.attribution, parsed.attribution),
    intent: booking.intent ?? parsed.intent,
    notes: recovered ? parsed.remainder : booking.notes,
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
    quote.recurring_estimate !== null ||
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
    property.occupants !== null ||
    Boolean(property.size_label) ||
    Boolean(property.home_type) ||
    Boolean(property.condition) ||
    Boolean(property.last_cleaned) ||
    Boolean(property.excluded_areas?.length)
  );
}

export function hasAttributionContent(
  attribution: BookingAttribution | null
): attribution is BookingAttribution {
  if (!attribution) return false;
  return Object.values(attribution).some((value) => Boolean(value));
}
