import type {
  BandLookupRangeConfig,
  BedroomBandConfig,
  CanonicalService,
  InlineWizardConfig,
  PerServiceBranchConfig,
  PricingConfig,
  PricingEngine,
  RoomPlusSqftConfig,
  ServiceBaseMultConfig,
  SqftRateMinConfig,
} from "./pricingConfigs";

/**
 * Initial pricing configs, transcribed from the values each site currently
 * hardcodes. Seeding these means the first fetch from a site produces exactly
 * the prices it produced before, so the migration is observable but inert.
 *
 * Once a site has been edited in the dashboard, its row is the source of truth
 * and these values are only used to seed sites that have no row yet.
 */

/**
 * Winter Haven, Deltona and Haines City ship an identical engine.
 *
 * `alsoMarketed` names services a site advertises that the engine has no branch
 * for. They are recorded so the dashboard can show them as gaps instead of
 * quietly pretending the site does not sell them.
 */
function bedroomBandDefaults(
  alsoMarketed: { key: string; label: string; canonicalKey: CanonicalService }[] = []
): BedroomBandConfig {
  return {
    kind: "bedroom-band",
    services: [
      {
        key: "residential-standard",
        label: "Residential standard clean",
        canonicalKey: "standard",
        enabled: true,
      },
      {
        key: "residential-deep",
        label: "Residential deep clean",
        canonicalKey: "deep",
        enabled: true,
      },
      {
        key: "residential-move",
        label: "Move-in / move-out clean",
        canonicalKey: "move-in-out",
        enabled: true,
      },
      {
        key: "commercial",
        label: "Commercial / office",
        canonicalKey: "commercial-office",
        enabled: true,
      },
      {
        key: "post-construction",
        label: "Post-construction",
        canonicalKey: "post-construction",
        enabled: true,
      },
      ...alsoMarketed.map((service) => ({ ...service, enabled: true })),
    ],
    bedroomBase: [
      { bedrooms: 0, price: 99 },
      { bedrooms: 1, price: 119 },
      { bedrooms: 2, price: 139 },
      { bedrooms: 3, price: 169 },
      { bedrooms: 4, price: 199 },
      { bedrooms: 5, price: 229 },
    ],
    bathRate: 20,
    sqftBands: [
      { key: "under-1000", label: "Under 1,000 sq ft", multiplier: 0.9 },
      { key: "1000-1500", label: "1,000–1,500 sq ft", multiplier: 1 },
      { key: "1500-2500", label: "1,500–2,500 sq ft", multiplier: 1.1 },
      { key: "2500-4000", label: "2,500–4,000 sq ft", multiplier: 1.25 },
      { key: "4000-plus", label: "4,000+ sq ft", multiplier: 1.4 },
    ],
    defaultSqftBand: "1000-1500",
    commercialByBand: [
      { key: "under-1000", value: 149 },
      { key: "1000-1500", value: 199 },
      { key: "1500-2500", value: 249 },
      { key: "2500-4000", value: 329 },
      { key: "4000-plus", value: 399 },
    ],
    postByBand: [
      { key: "under-1000", value: 299 },
      { key: "1000-1500", value: 379 },
      { key: "1500-2500", value: 449 },
      { key: "2500-4000", value: 549 },
      { key: "4000-plus", value: 649 },
    ],
    levelMultipliers: [
      { key: "standard", label: "Standard", multiplier: 1 },
      { key: "deep", label: "Deep clean", multiplier: 1.4 },
      { key: "move", label: "Move-in / move-out", multiplier: 1.2 },
      { key: "post", label: "Post-construction detailing", multiplier: 1.3 },
    ],
    addOns: [
      { key: "fridge", label: "Inside fridge", price: 25 },
      { key: "oven", label: "Inside oven", price: 25 },
      { key: "windows", label: "Interior windows", price: 40 },
      { key: "cabinets", label: "Inside cabinets", price: 30 },
      { key: "baseboards", label: "Baseboards", price: 35 },
    ],
    maxBedrooms: 5,
    maxBathrooms: 4,
    roundToNearest: 5,
    rangeSpread: 0.1,
  };
}

const windermere: ServiceBaseMultConfig = {
  kind: "service-base-mult",
  services: [
    {
      key: "house-cleaning",
      label: "House Cleaning",
      canonicalKey: "standard",
      enabled: true,
    },
    {
      key: "apartment-cleaning",
      label: "Apartment Cleaning",
      canonicalKey: "recurring",
      enabled: true,
    },
    {
      key: "deep-cleaning",
      label: "Deep Cleaning",
      canonicalKey: "deep",
      enabled: true,
    },
    {
      key: "move-out-move-in-cleaning",
      label: "Move Out / Move In Cleaning",
      canonicalKey: "move-in-out",
      enabled: true,
    },
    {
      key: "post-construction-cleaning",
      label: "Post Construction Cleaning",
      canonicalKey: "post-construction",
      enabled: true,
    },
    {
      key: "event-cleaning",
      label: "Event Cleaning",
      canonicalKey: "event",
      enabled: true,
    },
  ],
  serviceBaseCents: [
    { key: "house-cleaning", value: 18000 },
    { key: "apartment-cleaning", value: 14000 },
    { key: "move-out-move-in-cleaning", value: 28000 },
    { key: "post-construction-cleaning", value: 35000 },
    { key: "deep-cleaning", value: 26000 },
    { key: "event-cleaning", value: 22000 },
  ],
  /** Ordered as the site's calculator presents them. */
  propertyMultipliers: [
    { key: "house", label: "House", multiplier: 1.1 },
    { key: "apartment", label: "Apartment", multiplier: 0.9 },
    { key: "townhome", label: "Townhome", multiplier: 1 },
  ],
  sqftMultipliers: [
    { key: "under-1500", label: "Under 1,500 sq ft", multiplier: 0.9 },
    { key: "1500-2500", label: "1,500 – 2,500 sq ft", multiplier: 1 },
    { key: "2500-4000", label: "2,500 – 4,000 sq ft", multiplier: 1.25 },
    { key: "4000-plus", label: "4,000+ sq ft", multiplier: 1.55 },
  ],
  frequencyMultipliers: [
    { key: "one-time", label: "One-time", multiplier: 1 },
    { key: "weekly", label: "Weekly", multiplier: 0.85 },
    { key: "bi-weekly", label: "Bi-weekly", multiplier: 0.9 },
    { key: "monthly", label: "Monthly", multiplier: 0.95 },
  ],
  addonCents: [
    { key: "oven", label: "Inside oven", cents: 4500 },
    { key: "fridge", label: "Inside refrigerator", cents: 4500 },
    { key: "windows", label: "Interior windows", cents: 7500 },
    { key: "laundry", label: "Laundry (1 load)", cents: 3500 },
    { key: "cabinets", label: "Inside cabinets", cents: 5500 },
  ],
  bedroomCents: 2500,
  bathroomCents: 3000,
  frequencyServices: ["house-cleaning", "apartment-cleaning"],
};

const apopka: RoomPlusSqftConfig = {
  kind: "room-plus-sqft",
  services: [
    {
      key: "residential",
      label: "Residential Cleaning",
      canonicalKey: "standard",
      enabled: true,
    },
    {
      key: "deep-cleaning",
      label: "Deep Cleaning",
      canonicalKey: "deep",
      enabled: true,
    },
    {
      key: "move-in-out",
      label: "Move-In/Move-Out",
      canonicalKey: "move-in-out",
      enabled: true,
    },
    {
      key: "commercial",
      label: "Commercial Cleaning",
      canonicalKey: "commercial-office",
      enabled: true,
    },
    {
      key: "office",
      label: "Office Cleaning",
      canonicalKey: "commercial-office",
      enabled: true,
    },
    {
      key: "carpet-upholstery",
      label: "Carpet & Upholstery",
      canonicalKey: "carpet",
      enabled: true,
    },
  ],
  serviceRates: [
    {
      key: "residential",
      startingAt: 129,
      baseRate: 89,
      perBedroom: 25,
      perBathroom: 30,
      perSqFt: 0.05,
    },
    {
      key: "deep-cleaning",
      startingAt: 249,
      baseRate: 179,
      perBedroom: 40,
      perBathroom: 45,
      perSqFt: 0.08,
    },
    {
      key: "move-in-out",
      startingAt: 299,
      baseRate: 219,
      perBedroom: 45,
      perBathroom: 50,
      perSqFt: 0.09,
    },
    {
      key: "commercial",
      startingAt: 199,
      baseRate: 149,
      perBedroom: 0,
      perBathroom: 35,
      perSqFt: 0.06,
    },
    {
      key: "office",
      startingAt: 159,
      baseRate: 119,
      perBedroom: 0,
      perBathroom: 30,
      perSqFt: 0.055,
    },
    {
      key: "carpet-upholstery",
      startingAt: 149,
      baseRate: 99,
      perBedroom: 35,
      perBathroom: 0,
      perSqFt: 0.12,
    },
  ],
  freeSqFt: 800,
  addOns: [
    { key: "fridge", label: "Inside fridge", price: 35 },
    { key: "oven", label: "Inside oven", price: 35 },
    { key: "windows", label: "Interior windows", price: 45 },
    { key: "laundry", label: "Laundry (1 load)", price: 25 },
    { key: "blinds", label: "Blinds dusted", price: 30 },
    { key: "garage", label: "Garage sweep", price: 40 },
  ],
  frequencies: [
    { key: "one-time", label: "One-time", discount: 0 },
    { key: "weekly", label: "Weekly", discount: 0.2 },
    { key: "biweekly", label: "Biweekly", discount: 0.15 },
    { key: "monthly", label: "Monthly", discount: 0.1 },
  ],
};

const kissimmee: BandLookupRangeConfig = {
  kind: "band-lookup-range",
  services: [
    {
      key: "residential-cleaning",
      label: "Residential Cleaning",
      canonicalKey: "standard",
      enabled: true,
    },
    {
      key: "deep-cleaning",
      label: "Deep Cleaning",
      canonicalKey: "deep",
      enabled: true,
    },
    {
      key: "move-in-move-out",
      label: "Move In / Move Out",
      canonicalKey: "move-in-out",
      enabled: true,
    },
    {
      key: "vacation-rental-cleaning",
      label: "Vacation Rental Cleaning",
      canonicalKey: "airbnb-turnover",
      enabled: true,
    },
    {
      key: "commercial-cleaning",
      label: "Commercial Cleaning",
      canonicalKey: "commercial-office",
      enabled: true,
    },
    {
      key: "recurring-cleaning",
      label: "Recurring Cleaning",
      canonicalKey: "recurring",
      enabled: true,
    },
  ],
  basePrices: [
    { key: "residential-cleaning", value: 129 },
    { key: "deep-cleaning", value: 249 },
    { key: "move-in-move-out", value: 279 },
    { key: "vacation-rental-cleaning", value: 159 },
    { key: "commercial-cleaning", value: 199 },
    { key: "recurring-cleaning", value: 109 },
  ],
  bedroomAddon: [
    { key: "Studio", value: 0 },
    { key: "1", value: 0 },
    { key: "2", value: 20 },
    { key: "3", value: 40 },
    { key: "4", value: 70 },
    { key: "5+", value: 100 },
  ],
  bathroomAddon: [
    { key: "1", value: 0 },
    { key: "1.5", value: 15 },
    { key: "2", value: 30 },
    { key: "2.5", value: 45 },
    { key: "3", value: 60 },
    { key: "3.5", value: 75 },
    { key: "4+", value: 95 },
  ],
  frequencyMultipliers: [
    { key: "One-time", label: "One-time", multiplier: 1 },
    { key: "Weekly", label: "Weekly", multiplier: 0.82 },
    { key: "Bi-weekly", label: "Bi-weekly", multiplier: 0.88 },
    { key: "Monthly", label: "Monthly", multiplier: 0.94 },
  ],
  sqftThreshold: 2000,
  sqftStep: 250,
  sqftStepPrice: 15,
  rangeLow: 0.92,
  rangeHigh: 1.12,
};

const davenport: SqftRateMinConfig = {
  kind: "sqft-rate-min",
  services: [
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
  ],
  serviceRates: [
    { key: "house", perSqft: 0.12, minBase: 129 },
    { key: "apartment", perSqft: 0.13, minBase: 99 },
    { key: "move", perSqft: 0.18, minBase: 189 },
    { key: "airbnb", perSqft: 0.16, minBase: 149 },
    { key: "post-construction", perSqft: 0.22, minBase: 249 },
    { key: "maintenance", perSqft: 0.11, minBase: 109 },
    { key: "deep", perSqft: 0.2, minBase: 199 },
  ],
  bedroomRate: 18,
  bathroomRate: 28,
  frequencyMultipliers: [
    { key: "one-time", label: "One-time", multiplier: 1 },
    { key: "weekly", label: "Weekly", multiplier: 0.85 },
    { key: "bi-weekly", label: "Bi-weekly", multiplier: 0.9 },
    { key: "monthly", label: "Monthly", multiplier: 0.95 },
  ],
  addOns: [
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
  ],
  sqftPresets: [
    { label: "Under 800 sq ft", value: 600 },
    { label: "800–1,200 sq ft", value: 1000 },
    { label: "1,200–2,000 sq ft", value: 1600 },
    { label: "2,000–2,600 sq ft", value: 2200 },
    { label: "2,600+ sq ft", value: 3000 },
  ],
  minSqft: 400,
  maxSqft: 6000,
};

const cleaningWeekly: PerServiceBranchConfig = {
  kind: "per-service-branch",
  services: [
    {
      key: "home-cleaning",
      label: "Home Cleaning",
      canonicalKey: "recurring",
      enabled: true,
    },
    {
      key: "office-cleaning",
      label: "Office Cleaning",
      canonicalKey: "commercial-office",
      enabled: true,
    },
    {
      key: "deep-cleaning",
      label: "Deep Cleaning",
      canonicalKey: "deep",
      enabled: true,
    },
    {
      key: "move-in-out",
      label: "Move-In / Move-Out",
      canonicalKey: "move-in-out",
      enabled: true,
    },
    {
      key: "post-construction",
      label: "Post-Construction",
      canonicalKey: "post-construction",
      enabled: true,
    },
    {
      key: "airbnb-turnover",
      label: "Airbnb Turnover",
      canonicalKey: "airbnb-turnover",
      enabled: true,
    },
  ],
  homeCleaning: {
    base: 129,
    perBed: 15,
    perBath: 10,
    per500SqFt: 12,
    includedBedrooms: 2,
    includedBathrooms: 2,
    includedSqFt: 1500,
    frequencyMultipliers: [
      { key: "weekly", label: "Weekly", multiplier: 1 },
      { key: "biweekly", label: "Every other week", multiplier: 1.15 },
      { key: "monthly", label: "Monthly", multiplier: 1.35 },
    ],
  },
  officeCleaning: {
    base: 199,
    per500SqFt: 18,
    perRestroom: 25,
    includedRestrooms: 2,
    includedSqFt: 2000,
    frequencyMultipliers: [
      { key: "weekly", label: "Weekly", multiplier: 1 },
      { key: "biweekly", label: "Every other week", multiplier: 1.12 },
      { key: "monthly", label: "Monthly", multiplier: 1.3 },
    ],
  },
  deepCleaningMultiplier: 1.8,
  moveInOut: {
    base: 249,
    perBed: 25,
    perBath: 20,
    per500SqFt: 18,
    includedBedrooms: 2,
    includedBathrooms: 2,
    includedSqFt: 1500,
  },
  postConstruction: {
    base: 299,
    per500SqFt: 22,
    includedSqFt: 2000,
    debrisMultipliers: [
      { key: "light", label: "Light debris", multiplier: 1 },
      { key: "medium", label: "Medium debris", multiplier: 1.25 },
      { key: "heavy", label: "Heavy debris", multiplier: 1.55 },
    ],
  },
  airbnbTurnover: {
    base: 119,
    perBed: 12,
    perBath: 10,
    includedBedrooms: 1,
    includedBathrooms: 1,
    highVolumeMultiplier: 0.92,
    highVolumeThreshold: 4,
  },
  sqftBands: [
    { label: "Under 1,000", value: 900 },
    { label: "1,000–1,500", value: 1250 },
    { label: "1,500–2,500", value: 2000 },
    { label: "2,500–4,000", value: 3200 },
    { label: "4,000+", value: 4500 },
  ],
};

const sanford: InlineWizardConfig = {
  kind: "inline-wizard",
  services: [
    {
      key: "Maintenance Cleaning",
      label: "Maintenance Cleaning",
      canonicalKey: "recurring",
      enabled: true,
    },
    {
      key: "Deep Cleaning",
      label: "Deep Cleaning",
      canonicalKey: "deep",
      enabled: true,
    },
    {
      key: "Move In / Move Out Cleaning",
      label: "Move In / Move Out Cleaning",
      canonicalKey: "move-in-out",
      enabled: true,
    },
    {
      key: "Post-construction Cleaning",
      label: "Post-construction Cleaning",
      canonicalKey: "post-construction",
      enabled: true,
    },
    {
      key: "Hourly Cleaning",
      label: "Hourly Cleaning",
      canonicalKey: "hourly",
      enabled: true,
    },
  ],
  standardBase: 157,
  per1000SqFtOver: 10,
  perBedroomOver: 10,
  perBathroomOver: 12,
  includedSqFt: 1000,
  moveOut: {
    base: 277,
    per1000SqFtOver: 10,
    perBedroomOver: 10,
    perBathroomOver: 6.5,
  },
  conditionSurcharges: [
    { key: "Very clean", label: "Very clean", price: 0 },
    { key: "Pretty clean", label: "Pretty clean", price: 25 },
    { key: "Average", label: "Average", price: 55 },
    { key: "Pretty dirty", label: "Pretty dirty", price: 115 },
    { key: "Very dirty", label: "Very dirty", price: 195 },
  ],
  hourlyRate: 55,
  maintenance: {
    byFrequency: [
      { key: "Weekly", value: 109.9 },
      { key: "Every Other Week", value: 120.89 },
      { key: "Every 4 Weeks", value: 141.3 },
    ],
    per1000SqFt: 7,
    perBedroom: 7,
    perBathroom: 8.2,
  },
  extras: [
    { name: "Behind fridge", price: 20, hasQuantity: false },
    { name: "Behind oven", price: 20, hasQuantity: false },
    { name: "Inside oven", price: 35, hasQuantity: false },
    { name: "Deep Cleaning", price: 40, hasQuantity: false },
    { name: "Heavy Duty", price: 80, hasQuantity: false },
    { name: "Inside fridge", price: 30, hasQuantity: false },
    {
      name: "Patio windows in/out",
      price: 10,
      hasQuantity: true,
      unit: "window",
    },
    {
      name: "Interior windows (all, excludes patio)",
      price: 30,
      hasQuantity: false,
    },
    { name: "Wet wipe window blinds", price: 10, hasQuantity: true, unit: "blind" },
    { name: "Organization (30 min)", price: 20, hasQuantity: false },
    { name: "Green Cleaning", price: 0, hasQuantity: false },
    { name: "Dishes", price: 10, hasQuantity: false },
    { name: "Laundry & Folding", price: 20, hasQuantity: false },
    { name: "Carpet Cleaning", price: 20, hasQuantity: true, unit: "area" },
  ],
  maintenanceIncludedExtras: ["Inside oven", "Dishes", "Laundry & Folding"],
  discountMultiplier: 0.85,
  sqftBands: [
    { label: "Under 1,000", value: 900 },
    { label: "1,000–1,500", value: 1250 },
    { label: "1,500–2,500", value: 2000 },
    { label: "2,500–4,000", value: 3200 },
    { label: "4,000+", value: 4500 },
  ],
};

const celebration = bedroomBandDefaults([
  {
    key: "airbnb-cleaning",
    label: "Airbnb / Turnover Cleaning",
    canonicalKey: "airbnb-turnover",
  },
]);

export type SeedPricing = {
  slug: string;
  engine: PricingEngine;
  currency: string;
  config: PricingConfig;
};

export const SEED_PRICING: SeedPricing[] = [
  {
    slug: "winter-haven",
    engine: "bedroom-band",
    currency: "USD",
    config: bedroomBandDefaults(),
  },
  {
    slug: "deltona",
    engine: "bedroom-band",
    currency: "USD",
    config: bedroomBandDefaults([
      {
        key: "airbnb-cleaning",
        label: "Airbnb Cleaning",
        canonicalKey: "airbnb-turnover",
      },
      {
        key: "maintenance-cleaning",
        label: "Maintenance Cleaning",
        canonicalKey: "recurring",
      },
    ]),
  },
  {
    slug: "haines-city",
    engine: "bedroom-band",
    currency: "USD",
    config: bedroomBandDefaults([
      {
        key: "airbnb-cleaning",
        label: "Airbnb / Turnover Cleaning",
        canonicalKey: "airbnb-turnover",
      },
    ]),
  },
  {
    slug: "sanford-nc",
    engine: "bedroom-band",
    currency: "USD",
    config: bedroomBandDefaults([
      {
        key: "airbnb-cleaning",
        label: "Airbnb / Turnover Cleaning",
        canonicalKey: "airbnb-turnover",
      },
    ]),
  },
  {
    slug: "windermere",
    engine: "service-base-mult",
    currency: "USD",
    config: windermere,
  },
  { slug: "apopka", engine: "room-plus-sqft", currency: "USD", config: apopka },
  {
    slug: "kissimmee",
    engine: "band-lookup-range",
    currency: "USD",
    config: kissimmee,
  },
  {
    slug: "davenport",
    engine: "sqft-rate-min",
    currency: "USD",
    config: davenport,
  },
  {
    slug: "cleaning-weekly",
    engine: "per-service-branch",
    currency: "USD",
    config: cleaningWeekly,
  },
  {
    slug: "sanford",
    engine: "inline-wizard",
    currency: "USD",
    config: sanford,
  },
  {
    slug: "boca-raton",
    engine: "inline-wizard",
    currency: "USD",
    config: sanford,
  },
  {
    slug: "celebration",
    engine: "bedroom-band",
    currency: "USD",
    config: celebration,
  },
];
