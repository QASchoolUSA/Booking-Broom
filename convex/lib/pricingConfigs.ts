import { v, type Infer } from "convex/values";

/**
 * Central pricing configs for the cleaning sites.
 *
 * Each site keeps its own pricing algorithm; only the numbers live here. A
 * config's `kind` names the algorithm that consumes it, so a site can never be
 * served a config shaped for a different engine.
 */

/**
 * Shared vocabulary used to line up services across sites for comparison.
 * Each site maps its own service keys onto these.
 */
export const canonicalService = v.union(
  v.literal("standard"),
  v.literal("deep"),
  v.literal("move-in-out"),
  v.literal("airbnb-turnover"),
  v.literal("recurring"),
  v.literal("commercial-office"),
  v.literal("post-construction"),
  v.literal("carpet"),
  v.literal("event"),
  v.literal("hourly")
);

export type CanonicalService = Infer<typeof canonicalService>;

export const CANONICAL_SERVICES: {
  key: CanonicalService;
  label: string;
}[] = [
  { key: "standard", label: "Standard clean" },
  { key: "deep", label: "Deep clean" },
  { key: "move-in-out", label: "Move in / move out" },
  { key: "recurring", label: "Recurring / maintenance" },
  { key: "airbnb-turnover", label: "Airbnb / turnover" },
  { key: "commercial-office", label: "Commercial / office" },
  { key: "post-construction", label: "Post-construction" },
  { key: "carpet", label: "Carpet & upholstery" },
  { key: "event", label: "Event / after-party" },
  { key: "hourly", label: "Hourly" },
];

export const CANONICAL_SERVICE_LABELS: Record<CanonicalService, string> =
  Object.fromEntries(
    CANONICAL_SERVICES.map((s) => [s.key, s.label])
  ) as Record<CanonicalService, string>;

/** A site's own service key mapped onto the shared vocabulary. */
const serviceMapping = v.array(
  v.object({
    /** The site's internal key or slug, e.g. "move-out-move-in-cleaning". */
    key: v.string(),
    label: v.string(),
    canonicalKey: canonicalService,
    enabled: v.boolean(),
  })
);

const namedPrice = v.object({
  key: v.string(),
  label: v.string(),
  price: v.number(),
});

const keyedNumber = v.object({ key: v.string(), value: v.number() });

const labelledMultiplier = v.object({
  key: v.string(),
  label: v.string(),
  multiplier: v.number(),
});

/** Winter Haven, Deltona, Haines City. */
const bedroomBandFields = {
  kind: v.literal("bedroom-band"),
  services: serviceMapping,
  /** Residential base by bedroom count; 0 means studio. */
  bedroomBase: v.array(v.object({ bedrooms: v.number(), price: v.number() })),
  /** Charged for each bathroom past the first. */
  bathRate: v.number(),
  sqftBands: v.array(labelledMultiplier),
  defaultSqftBand: v.string(),
  commercialByBand: v.array(keyedNumber),
  postByBand: v.array(keyedNumber),
  /** Absolute multipliers: standard 1, deep 1.4, move 1.2, post 1.3. */
  levelMultipliers: v.array(labelledMultiplier),
  addOns: v.array(namedPrice),
  maxBedrooms: v.number(),
  maxBathrooms: v.number(),
  roundToNearest: v.number(),
  /** Display range as a fraction either side of the price, e.g. 0.1 for ±10%. */
  rangeSpread: v.number(),
};

/** Windermere. Every amount is in cents. */
const serviceBaseMultFields = {
  kind: v.literal("service-base-mult"),
  services: serviceMapping,
  serviceBaseCents: v.array(keyedNumber),
  propertyMultipliers: v.array(labelledMultiplier),
  sqftMultipliers: v.array(labelledMultiplier),
  frequencyMultipliers: v.array(labelledMultiplier),
  addonCents: v.array(v.object({ key: v.string(), label: v.string(), cents: v.number() })),
  bedroomCents: v.number(),
  bathroomCents: v.number(),
  /** Services where the frequency multiplier applies. */
  frequencyServices: v.array(v.string()),
};

/** Apopka. */
const roomPlusSqftFields = {
  kind: v.literal("room-plus-sqft"),
  services: serviceMapping,
  serviceRates: v.array(
    v.object({
      key: v.string(),
      /** Floor the discounted total can never fall below. */
      startingAt: v.number(),
      baseRate: v.number(),
      perBedroom: v.number(),
      perBathroom: v.number(),
      perSqFt: v.number(),
    })
  ),
  /** Square footage included before perSqFt starts applying. */
  freeSqFt: v.number(),
  addOns: v.array(namedPrice),
  frequencies: v.array(
    v.object({ key: v.string(), label: v.string(), discount: v.number() })
  ),
};

/** Kissimmee. Produces a low/high range rather than a single price. */
const bandLookupRangeFields = {
  kind: v.literal("band-lookup-range"),
  services: serviceMapping,
  basePrices: v.array(keyedNumber),
  /** Keyed by the picker label, e.g. "Studio", "3", "5+". */
  bedroomAddon: v.array(keyedNumber),
  bathroomAddon: v.array(keyedNumber),
  frequencyMultipliers: v.array(labelledMultiplier),
  sqftThreshold: v.number(),
  sqftStep: v.number(),
  sqftStepPrice: v.number(),
  rangeLow: v.number(),
  rangeHigh: v.number(),
};

/** Davenport. */
const sqftRateMinFields = {
  kind: v.literal("sqft-rate-min"),
  services: serviceMapping,
  serviceRates: v.array(
    v.object({ key: v.string(), perSqft: v.number(), minBase: v.number() })
  ),
  bedroomRate: v.number(),
  bathroomRate: v.number(),
  frequencyMultipliers: v.array(labelledMultiplier),
  addOns: v.array(namedPrice),
  /** Pickers whose value is the band midpoint fed into the sq-ft math. */
  sqftPresets: v.array(v.object({ label: v.string(), value: v.number() })),
  minSqft: v.number(),
  maxSqft: v.number(),
};

/**
 * Cleaning Weekly. Note the frequency multipliers are above 1: weekly is the
 * baseline and less-frequent visits cost more per visit.
 */
const perServiceBranchFields = {
  kind: v.literal("per-service-branch"),
  services: serviceMapping,
  homeCleaning: v.object({
    base: v.number(),
    perBed: v.number(),
    perBath: v.number(),
    per500SqFt: v.number(),
    includedBedrooms: v.number(),
    includedBathrooms: v.number(),
    includedSqFt: v.number(),
    frequencyMultipliers: v.array(labelledMultiplier),
  }),
  officeCleaning: v.object({
    base: v.number(),
    per500SqFt: v.number(),
    perRestroom: v.number(),
    includedRestrooms: v.number(),
    includedSqFt: v.number(),
    frequencyMultipliers: v.array(labelledMultiplier),
  }),
  /** Applied to a weekly home clean. */
  deepCleaningMultiplier: v.number(),
  moveInOut: v.object({
    base: v.number(),
    perBed: v.number(),
    perBath: v.number(),
    per500SqFt: v.number(),
    includedBedrooms: v.number(),
    includedBathrooms: v.number(),
    includedSqFt: v.number(),
  }),
  postConstruction: v.object({
    base: v.number(),
    per500SqFt: v.number(),
    includedSqFt: v.number(),
    debrisMultipliers: v.array(labelledMultiplier),
  }),
  airbnbTurnover: v.object({
    base: v.number(),
    perBed: v.number(),
    perBath: v.number(),
    includedBedrooms: v.number(),
    includedBathrooms: v.number(),
    /** Multiplier applied once the monthly turnover count passes the threshold. */
    highVolumeMultiplier: v.number(),
    highVolumeThreshold: v.number(),
  }),
  sqftBands: v.array(v.object({ label: v.string(), value: v.number() })),
};

/** Sanford. */
const inlineWizardFields = {
  kind: v.literal("inline-wizard"),
  services: serviceMapping,
  /** Base for maintenance, deep and post-construction cleans. */
  standardBase: v.number(),
  per1000SqFtOver: v.number(),
  perBedroomOver: v.number(),
  perBathroomOver: v.number(),
  /** Square footage / bedroom / bathroom included in the base. */
  includedSqFt: v.number(),
  moveOut: v.object({
    base: v.number(),
    per1000SqFtOver: v.number(),
    perBedroomOver: v.number(),
    perBathroomOver: v.number(),
  }),
  /** Only applied to move in / move out. */
  conditionSurcharges: v.array(namedPrice),
  hourlyRate: v.number(),
  maintenance: v.object({
    byFrequency: v.array(keyedNumber),
    per1000SqFt: v.number(),
    perBedroom: v.number(),
    perBathroom: v.number(),
  }),
  extras: v.array(
    v.object({
      name: v.string(),
      price: v.number(),
      hasQuantity: v.boolean(),
      unit: v.optional(v.string()),
    })
  ),
  /** Extras that also apply to the recurring maintenance price. */
  maintenanceIncludedExtras: v.array(v.string()),
  /** Blanket multiplier applied to every estimate, e.g. 0.85 for 15% off. */
  discountMultiplier: v.number(),
  sqftBands: v.array(v.object({ label: v.string(), value: v.number() })),
};

/** Celebration. Marketing prices only; there is no calculator. */
const headlineOnlyFields = {
  kind: v.literal("headline-only"),
  services: serviceMapping,
  headlines: v.array(
    v.object({
      key: v.string(),
      label: v.string(),
      fromPrice: v.number(),
      popular: v.optional(v.boolean()),
    })
  ),
};

export const bedroomBandConfig = v.object(bedroomBandFields);
export const serviceBaseMultConfig = v.object(serviceBaseMultFields);
export const roomPlusSqftConfig = v.object(roomPlusSqftFields);
export const bandLookupRangeConfig = v.object(bandLookupRangeFields);
export const sqftRateMinConfig = v.object(sqftRateMinFields);
export const perServiceBranchConfig = v.object(perServiceBranchFields);
export const inlineWizardConfig = v.object(inlineWizardFields);
export const headlineOnlyConfig = v.object(headlineOnlyFields);

export const pricingEngine = v.union(
  v.literal("bedroom-band"),
  v.literal("service-base-mult"),
  v.literal("room-plus-sqft"),
  v.literal("band-lookup-range"),
  v.literal("sqft-rate-min"),
  v.literal("per-service-branch"),
  v.literal("inline-wizard"),
  v.literal("headline-only")
);

export const pricingConfig = v.union(
  bedroomBandConfig,
  serviceBaseMultConfig,
  roomPlusSqftConfig,
  bandLookupRangeConfig,
  sqftRateMinConfig,
  perServiceBranchConfig,
  inlineWizardConfig,
  headlineOnlyConfig
);

export type PricingEngine = Infer<typeof pricingEngine>;
export type PricingConfig = Infer<typeof pricingConfig>;
export type BedroomBandConfig = Infer<typeof bedroomBandConfig>;
export type ServiceBaseMultConfig = Infer<typeof serviceBaseMultConfig>;
export type RoomPlusSqftConfig = Infer<typeof roomPlusSqftConfig>;
export type BandLookupRangeConfig = Infer<typeof bandLookupRangeConfig>;
export type SqftRateMinConfig = Infer<typeof sqftRateMinConfig>;
export type PerServiceBranchConfig = Infer<typeof perServiceBranchConfig>;
export type InlineWizardConfig = Infer<typeof inlineWizardConfig>;
export type HeadlineOnlyConfig = Infer<typeof headlineOnlyConfig>;
export type ServiceMapping = Infer<typeof serviceMapping>;

export const PRICING_ENGINE_LABELS: Record<PricingEngine, string> = {
  "bedroom-band": "Bedroom base + size band",
  "service-base-mult": "Service base + multipliers",
  "room-plus-sqft": "Base + rooms + square footage",
  "band-lookup-range": "Band lookup (range)",
  "sqft-rate-min": "Square footage rate + minimum",
  "per-service-branch": "Per-service formulas",
  "inline-wizard": "Wizard (Sanford)",
  "headline-only": "Headline prices only",
};

export function lookup(rows: { key: string; value: number }[], key: string) {
  return rows.find((r) => r.key === key)?.value;
}

export function lookupMultiplier(
  rows: { key: string; multiplier: number }[],
  key: string
) {
  return rows.find((r) => r.key === key)?.multiplier;
}
