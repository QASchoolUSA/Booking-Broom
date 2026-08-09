import type {
  BookingAttribution,
  BookingIntent,
  BookingProperty,
  BookingQuote,
  BookingQuoteAddOn,
} from "@/lib/types";

/**
 * Bookings created before the sites sent structured `property` / `quote` objects
 * carry the same information as prose inside `notes`. This recovers it so the
 * dashboard can render old and new bookings identically.
 */
export interface ParsedLegacyNotes {
  property: BookingProperty | null;
  quote: BookingQuote | null;
  attribution: BookingAttribution | null;
  intent: BookingIntent | null;
  /** Whatever did not look like a known key, i.e. the customer's own message. */
  remainder: string | null;
}

const EMPTY: ParsedLegacyNotes = {
  property: null,
  quote: null,
  attribution: null,
  intent: null,
  remainder: null,
};

function toNumber(value: string): number | undefined {
  const match = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** "$175 (range $158–$193)" -> { estimate: 175, low: 158, high: 193 } */
function parsePrice(value: string) {
  const amounts = value
    .replace(/,/g, "")
    .match(/\$?\d+(\.\d+)?/g)
    ?.map((raw) => Number(raw.replace("$", "")))
    .filter((n) => Number.isFinite(n));

  if (!amounts?.length) return undefined;
  if (amounts.length >= 3) {
    return { estimate: amounts[0], low: amounts[1], high: amounts[2] };
  }
  if (amounts.length === 2) {
    return { estimate: undefined, low: amounts[0], high: amounts[1] };
  }
  return { estimate: amounts[0], low: undefined, high: undefined };
}

function parseAddOns(value: string): BookingQuoteAddOn[] | undefined {
  const trimmed = value.trim();
  if (!trimmed || /^none$/i.test(trimmed)) return undefined;

  const addOns = trimmed
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      // Weekly formats line items as "Inside fridge ($25)".
      const withPrice = part.match(/^(.*?)\s*\(\$?(\d+(?:\.\d+)?)\)$/);
      if (withPrice) {
        return {
          label: withPrice[1].trim(),
          price: Number(withPrice[2]),
          quantity: null,
        };
      }
      return { label: part, price: null, quantity: null };
    });

  return addOns.length ? addOns : undefined;
}

/** Pulls "3 bedrooms", "2 bathrooms", "1800 sqft" out of a free-form size phrase. */
function parseSizePhrase(value: string) {
  const bedrooms = value.match(/(\d+(?:\.\d+)?)\s*(?:bed|bedroom|br\b)/i);
  const bathrooms = value.match(/(\d+(?:\.\d+)?)\s*(?:bath|bathroom|ba\b)/i);
  const squareFeet = value.match(/(\d[\d,]*)\s*(?:sq\.?\s*ft|sqft|square feet)/i);
  const studio = /\bstudio\b/i.test(value);

  return {
    bedrooms: bedrooms ? Number(bedrooms[1]) : studio ? 0 : undefined,
    bathrooms: bathrooms ? Number(bathrooms[1]) : undefined,
    squareFeet: squareFeet ? Number(squareFeet[1].replace(/,/g, "")) : undefined,
  };
}

export function parseLegacyNotes(notes: string | null | undefined): ParsedLegacyNotes {
  if (!notes?.trim()) return EMPTY;

  // Sites use either newlines (Haines City, Sanford, Davenport) or " · " (Apopka,
  // Windermere) to separate fields.
  const segments = notes
    .split(/\n|\s+·\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const property: BookingProperty = {
    bedrooms: null,
    bathrooms: null,
    square_feet: null,
    size_label: null,
    home_type: null,
    condition: null,
    occupants: null,
    last_cleaned: null,
    excluded_areas: null,
  };
  const quote: BookingQuote = {
    estimate: null,
    estimate_low: null,
    estimate_high: null,
    recurring_estimate: null,
    currency: "USD",
    service_level: null,
    frequency: null,
    add_ons: null,
    payment_terms: null,
    internal: false,
  };

  let sawProperty = false;
  let sawQuote = false;
  let intent: BookingIntent | null = null;
  let leadSource: string | null = null;
  const remainder: string[] = [];

  for (const segment of segments) {
    const keyed = segment.match(/^([A-Za-z][A-Za-z \-/.]*?)\s*:\s*(.*)$/);
    const key = keyed?.[1].toLowerCase().trim();
    const value = keyed?.[2].trim() ?? "";

    // Apopka and Windermere write "Estimate $189" with no colon.
    if (!keyed) {
      const bare = segment.match(/^estimate\s+\$?[\d,]/i);
      if (bare) {
        const price = parsePrice(segment);
        if (price) {
          quote.estimate = price.estimate ?? quote.estimate;
          quote.estimate_low = price.low ?? quote.estimate_low;
          quote.estimate_high = price.high ?? quote.estimate_high;
          sawQuote = true;
          continue;
        }
      }
      remainder.push(segment);
      continue;
    }

    if (!value) {
      remainder.push(segment);
      continue;
    }

    switch (key) {
      case "size":
      case "home": {
        property.size_label = value;
        const parsed = parseSizePhrase(value);
        property.bedrooms = parsed.bedrooms ?? property.bedrooms;
        property.bathrooms = parsed.bathrooms ?? property.bathrooms;
        property.square_feet = parsed.squareFeet ?? property.square_feet;
        sawProperty = true;
        break;
      }
      case "bedrooms":
      case "bedroom": {
        // A value like "not sure" is the customer talking, so keep it as a note.
        const bedrooms = toNumber(value);
        if (bedrooms === undefined) {
          remainder.push(segment);
          break;
        }
        property.bedrooms = bedrooms;
        sawProperty = true;
        break;
      }
      case "bathrooms":
      case "bathroom":
      case "restrooms": {
        const bathrooms = toNumber(value);
        if (bathrooms === undefined) {
          remainder.push(segment);
          break;
        }
        property.bathrooms = bathrooms;
        sawProperty = true;
        break;
      }
      case "sq ft":
      case "sqft":
      case "square footage":
      case "square feet": {
        const squareFeet = toNumber(value);
        if (squareFeet === undefined) {
          remainder.push(segment);
          break;
        }
        property.square_feet = squareFeet;
        sawProperty = true;
        break;
      }
      case "level":
      case "service level":
        quote.service_level = value;
        sawQuote = true;
        break;
      case "frequency":
        quote.frequency = value;
        sawQuote = true;
        break;
      case "add-ons":
      case "add ons":
      case "addons":
      case "line items":
        quote.add_ons = parseAddOns(value) ?? quote.add_ons;
        sawQuote = true;
        break;
      case "estimated price":
      case "estimate":
      case "estimate total":
      case "price": {
        const price = parsePrice(value);
        if (!price) {
          remainder.push(segment);
          break;
        }
        quote.estimate = price.estimate ?? quote.estimate;
        quote.estimate_low = price.low ?? quote.estimate_low;
        quote.estimate_high = price.high ?? quote.estimate_high;
        sawQuote = true;
        break;
      }
      // Sanford quotes an initial clean plus a lower ongoing rate.
      case "maintenance price":
      case "recurring price":
      case "ongoing price": {
        const recurring = toNumber(value);
        if (recurring === undefined) {
          remainder.push(segment);
          break;
        }
        quote.recurring_estimate = recurring;
        sawQuote = true;
        break;
      }
      case "payment":
        quote.payment_terms = value;
        sawQuote = true;
        break;
      // Davenport wrote these as prose before they had structured fields.
      case "intent":
        if (/^book/i.test(value)) intent = "book";
        else if (/^quote/i.test(value)) intent = "quote";
        else remainder.push(segment);
        break;
      case "source":
        leadSource = value;
        break;
      default:
        remainder.push(segment);
    }
  }

  return {
    property: sawProperty ? property : null,
    quote: sawQuote ? quote : null,
    attribution: leadSource
      ? {
          utm_source: leadSource,
          utm_medium: null,
          utm_campaign: null,
          utm_term: null,
          utm_content: null,
          gclid: null,
        }
      : null,
    intent,
    remainder: remainder.length ? remainder.join("\n") : null,
  };
}
