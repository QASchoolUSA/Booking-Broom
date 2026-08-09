import type {
  CreateBookingPropertyPayload,
  CreateBookingQuotePayload,
} from "@/lib/types";

const MAX_ADD_ONS = 25;

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

  return compact({
    bedrooms: num(input.bedrooms),
    bathrooms: num(input.bathrooms),
    squareFeet: num(input.square_feet),
    sizeLabel: str(input.size_label),
    homeType: str(input.home_type),
  });
}

export function normalizeQuote(input: CreateBookingQuotePayload | undefined) {
  if (!input || typeof input !== "object") return undefined;

  const addOns = Array.isArray(input.add_ons)
    ? input.add_ons
        .map((addOn) => {
          const label = str(addOn?.label);
          if (!label) return undefined;
          return compact({ label, price: num(addOn?.price) }) as {
            label: string;
            price?: number;
          };
        })
        .filter((addOn): addOn is { label: string; price?: number } => Boolean(addOn))
        .slice(0, MAX_ADD_ONS)
    : undefined;

  return compact({
    estimate: num(input.estimate),
    estimateLow: num(input.estimate_low),
    estimateHigh: num(input.estimate_high),
    currency: str(input.currency),
    serviceLevel: str(input.service_level),
    frequency: str(input.frequency),
    addOns: addOns?.length ? addOns : undefined,
    paymentTerms: str(input.payment_terms),
  });
}
