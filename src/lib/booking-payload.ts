import type {
  CreateBookingAttributionPayload,
  CreateBookingPropertyPayload,
  CreateBookingQuotePayload,
} from "@/lib/types";

const MAX_ADD_ONS = 25;
const MAX_EXCLUDED_AREAS = 25;

function num(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function str(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 200) : undefined;
}

function compact<T extends object>(obj: T): T | undefined {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
  return entries.length ? (Object.fromEntries(entries) as T) : undefined;
}

/** Site payloads are untrusted, so coerce to the shapes the Convex validators accept. */
export function normalizeProperty(input: CreateBookingPropertyPayload | undefined) {
  if (!input || typeof input !== "object") return undefined;

  const excludedAreas = Array.isArray(input.excluded_areas)
    ? input.excluded_areas
        .map((area) => str(area))
        .filter((area): area is string => Boolean(area))
        .slice(0, MAX_EXCLUDED_AREAS)
    : undefined;

  return compact({
    bedrooms: num(input.bedrooms),
    bathrooms: num(input.bathrooms),
    squareFeet: num(input.square_feet),
    sizeLabel: str(input.size_label),
    homeType: str(input.home_type),
    condition: str(input.condition),
    occupants: num(input.occupants),
    lastCleaned: str(input.last_cleaned),
    excludedAreas: excludedAreas?.length ? excludedAreas : undefined,
  });
}

export function normalizeQuote(input: CreateBookingQuotePayload | undefined) {
  if (!input || typeof input !== "object") return undefined;

  type NormalizedAddOn = { label: string; price?: number; quantity?: number };

  const addOns = Array.isArray(input.add_ons)
    ? input.add_ons
        .map((addOn) => {
          const label = str(addOn?.label);
          if (!label) return undefined;
          return compact({
            label,
            price: num(addOn?.price),
            quantity: num(addOn?.quantity),
          }) as NormalizedAddOn;
        })
        .filter((addOn): addOn is NormalizedAddOn => Boolean(addOn))
        .slice(0, MAX_ADD_ONS)
    : undefined;

  return compact({
    estimate: num(input.estimate),
    estimateLow: num(input.estimate_low),
    estimateHigh: num(input.estimate_high),
    recurringEstimate: num(input.recurring_estimate),
    currency: str(input.currency),
    serviceLevel: str(input.service_level),
    frequency: str(input.frequency),
    addOns: addOns?.length ? addOns : undefined,
    paymentTerms: str(input.payment_terms),
    internal: input.internal === true ? true : undefined,
  });
}

export function normalizeAttribution(
  input: CreateBookingAttributionPayload | undefined
) {
  if (!input || typeof input !== "object") return undefined;

  return compact({
    utmSource: str(input.utm_source),
    utmMedium: str(input.utm_medium),
    utmCampaign: str(input.utm_campaign),
    utmTerm: str(input.utm_term),
    utmContent: str(input.utm_content),
    gclid: str(input.gclid),
  });
}

/** Anything other than the two known intents is dropped rather than stored. */
export function normalizeIntent(input: unknown): "quote" | "book" | undefined {
  return input === "quote" || input === "book" ? input : undefined;
}
