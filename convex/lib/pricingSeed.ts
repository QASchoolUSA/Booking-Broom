import type { PricingConfig, PricingEngine, SqftRateMinConfig } from "./pricingConfigs";

/**
 * Unified Nikita sqft-rate-min seeds for every marketing site.
 *
 * All sites use Davenport’s service key set (house, apartment, deep, move,
 * airbnb, maintenance, post-construction) so dashboard compare and marketing
 * calculators can share one shape. Marketing sites that still hardcode older
 * engines/keys must adopt this config (or map carefully) for live quotes.
 *
 * Rate tiers (USD / sqft):
 * - Standard (9 sites): house/maintenance 0.15, deep 0.20, move 0.23,
 *   airbnb 0.12, post-construction 0.39; apartment uses the house rate.
 * - Discount −25% rounded 2dp (winter-haven, haines-city, davenport):
 *   0.11 / 0.15 / 0.17 / 0.09 / 0.29
 */

const DAVENPORT_SERVICES: SqftRateMinConfig["services"] = [
  { key: "house", label: "House Cleaning", canonicalKey: "standard", enabled: true },
  {
    key: "apartment",
    label: "Apartment Cleaning",
    canonicalKey: "standard",
    enabled: true,
  },
  { key: "deep", label: "Deep Cleaning", canonicalKey: "deep", enabled: true },
  {
    key: "move",
    label: "Move In / Move Out",
    canonicalKey: "move-in-out",
    enabled: true,
  },
  {
    key: "airbnb",
    label: "Airbnb Turnover",
    canonicalKey: "airbnb-turnover",
    enabled: true,
  },
  {
    key: "maintenance",
    label: "Maintenance Cleaning",
    canonicalKey: "recurring",
    enabled: true,
  },
  {
    key: "post-construction",
    label: "Post-Construction",
    canonicalKey: "post-construction",
    enabled: true,
  },
];

const STANDARD_RATES = {
  house: { perSqft: 0.15, minBase: 129 },
  apartment: { perSqft: 0.15, minBase: 99 },
  maintenance: { perSqft: 0.15, minBase: 109 },
  deep: { perSqft: 0.2, minBase: 199 },
  move: { perSqft: 0.23, minBase: 189 },
  airbnb: { perSqft: 0.12, minBase: 149 },
  "post-construction": { perSqft: 0.39, minBase: 249 },
} as const;

const DISCOUNT_RATES = {
  house: { perSqft: 0.11, minBase: 97 },
  apartment: { perSqft: 0.11, minBase: 74 },
  maintenance: { perSqft: 0.11, minBase: 82 },
  deep: { perSqft: 0.15, minBase: 149 },
  move: { perSqft: 0.17, minBase: 142 },
  airbnb: { perSqft: 0.09, minBase: 112 },
  "post-construction": { perSqft: 0.29, minBase: 187 },
} as const;

const SHARED_ADD_ONS: SqftRateMinConfig["addOns"] = [
  { key: "kitchen-deep", label: "Kitchen deep clean", price: 45 },
  { key: "oven", label: "Oven cleaning", price: 35 },
  { key: "fridge", label: "Fridge cleaning", price: 35 },
  { key: "windows-interior", label: "Windows (interior)", price: 40 },
  { key: "windows-exterior", label: "Windows (exterior)", price: 55 },
  { key: "laundry", label: "Laundry fold & put away", price: 25 },
  { key: "cabinets", label: "Inside cabinets", price: 40 },
  { key: "garage", label: "Garage sweep & wipe", price: 50 },
  { key: "balcony", label: "Patio / balcony", price: 30 },
  { key: "pets", label: "Pet-friendly detail", price: 20 },
];

const SHARED_SQFT_PRESETS: SqftRateMinConfig["sqftPresets"] = [
  { label: "Under 800 sq ft", value: 600 },
  { label: "800–1,200 sq ft", value: 1000 },
  { label: "1,200–2,000 sq ft", value: 1600 },
  { label: "2,000–2,600 sq ft", value: 2200 },
  { label: "2,600+ sq ft", value: 3000 },
];

const SHARED_FREQUENCY: SqftRateMinConfig["frequencyMultipliers"] = [
  { key: "one-time", label: "One-time", multiplier: 1 },
  { key: "weekly", label: "Weekly", multiplier: 0.85 },
  { key: "bi-weekly", label: "Bi-weekly", multiplier: 0.9 },
  { key: "monthly", label: "Monthly", multiplier: 0.95 },
];

type RateRow = { perSqft: number; minBase: number };

function makeSqftRateMinConfig({
  discount,
  services = DAVENPORT_SERVICES,
}: {
  discount: boolean;
  services?: SqftRateMinConfig["services"];
}): SqftRateMinConfig {
  const rates: Record<keyof typeof STANDARD_RATES, RateRow> = discount
    ? DISCOUNT_RATES
    : STANDARD_RATES;

  return {
    kind: "sqft-rate-min",
    services,
    serviceRates: [
      { key: "house", ...rates.house },
      { key: "apartment", ...rates.apartment },
      { key: "move", ...rates.move },
      { key: "airbnb", ...rates.airbnb },
      { key: "post-construction", ...rates["post-construction"] },
      { key: "maintenance", ...rates.maintenance },
      { key: "deep", ...rates.deep },
    ],
    bedroomRate: discount ? 14 : 18,
    bathroomRate: discount ? 21 : 28,
    frequencyMultipliers: SHARED_FREQUENCY,
    addOns: SHARED_ADD_ONS,
    sqftPresets: SHARED_SQFT_PRESETS,
    minSqft: 400,
    maxSqft: 6000,
  };
}

const standardConfig = makeSqftRateMinConfig({ discount: false });
const discountConfig = makeSqftRateMinConfig({ discount: true });

/** Sites that receive Nikita’s −25% rounded rates. */
const DISCOUNT_SLUGS = new Set(["winter-haven", "haines-city", "davenport"]);

export type SeedPricing = {
  slug: string;
  engine: PricingEngine;
  currency: string;
  config: PricingConfig;
};

const ALL_SITE_SLUGS = [
  "winter-haven",
  "deltona",
  "haines-city",
  "sanford-nc",
  "windermere",
  "apopka",
  "kissimmee",
  "davenport",
  "cleaning-weekly",
  "sanford",
  "boca-raton",
  "celebration",
] as const;

export const SEED_PRICING: SeedPricing[] = ALL_SITE_SLUGS.map((slug) => ({
  slug,
  engine: "sqft-rate-min" as const,
  currency: "USD",
  config: DISCOUNT_SLUGS.has(slug) ? discountConfig : standardConfig,
}));

/** Exported for tests / scripts that want to build a config without a seed row. */
export { makeSqftRateMinConfig };
