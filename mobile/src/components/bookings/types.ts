import type { Id } from "@/lib/api";

export type BookingStatus =
  | "new"
  | "confirmed"
  | "assigned"
  | "completed"
  | "cancelled";

export const BOOKING_STATUSES: BookingStatus[] = [
  "new",
  "confirmed",
  "assigned",
  "completed",
  "cancelled",
];

export type BookingProperty = {
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  size_label: string | null;
  home_type: string | null;
  condition: string | null;
  occupants: number | null;
  last_cleaned: string | null;
  excluded_areas: string[] | null;
};

export type BookingAddOn = {
  label: string;
  price: number | null;
  quantity: number | null;
};

export type BookingQuote = {
  estimate: number | null;
  estimate_low: number | null;
  estimate_high: number | null;
  recurring_estimate: number | null;
  currency: string;
  service_level: string | null;
  frequency: string | null;
  add_ons: BookingAddOn[] | null;
  payment_terms: string | null;
  internal: boolean;
};

export type BookingRow = {
  id: Id<"bookings">;
  status: BookingStatus;
  customer_name: string;
  service_type: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  notes: string | null;
  internal_notes: string | null;
  created_at: string;
  site?: {
    slug: string;
    name: string;
    accent_color: string;
  };
  property?: BookingProperty | null;
  quote?: BookingQuote | null;
};

export function statusTone(
  status: BookingStatus
): "primary" | "success" | "accent" | "neutral" | "destructive" {
  if (status === "new") return "accent";
  if (status === "confirmed" || status === "completed") return "success";
  if (status === "cancelled") return "destructive";
  if (status === "assigned") return "primary";
  return "neutral";
}

export function hasPropertyContent(
  property: BookingProperty | null | undefined
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

/** Quote content for mobile UI — payment_terms intentionally ignored. */
export function hasQuoteContent(
  quote: BookingQuote | null | undefined
): quote is BookingQuote {
  if (!quote) return false;
  return (
    quote.estimate !== null ||
    quote.estimate_low !== null ||
    quote.estimate_high !== null ||
    quote.recurring_estimate !== null ||
    Boolean(quote.service_level) ||
    Boolean(quote.frequency) ||
    Boolean(quote.add_ons?.length)
  );
}
