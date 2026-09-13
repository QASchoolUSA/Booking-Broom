import {
  type BandLookupRangeConfig,
  type BedroomBandConfig,
  type CanonicalService,
  type HeadlineOnlyConfig,
  type InlineWizardConfig,
  type PerServiceBranchConfig,
  type PricingConfig,
  type RoomPlusSqftConfig,
  type ServiceBaseMultConfig,
  type ServiceMapping,
  type SqftRateMinConfig,
} from "./pricingConfigs";

/**
 * Every site's pricing algorithm, reimplemented here so the dashboard can
 * price the same property on all of them. The sites remain the authority for
 * what a customer is actually quoted — these functions must mirror them, never
 * lead them.
 */

/** Residential services that commonly accept add-on line items. */
const ADDON_SERVICES: CanonicalService[] = [
  "standard",
  "deep",
  "move-in-out",
  "recurring",
  "airbnb-turnover",
];

/**
 * The property every site gets priced against by default. Chosen as a common
 * mid-market home rather than any site's default so no site is flattered.
 */
export const REFERENCE_BASKET = {
  bedrooms: 3,
  bathrooms: 2,
  /** Midpoint of the 1,500–2,500 sq ft band. */
  squareFeet: 2000,
  /** Band key preferred when an engine prices by band rather than raw footage. */
  sqftBandKeys: ["1500-2500"],
  /** Used by engines that charge by the hour. */
  hours: 2,
  /** Neutral middle option for engines that surcharge on property condition. */
  conditionKey: "Average",
  propertyTypeKey: "house",
  debrisKey: "light",
} as const;

export const REFERENCE_BASKET_LABEL = "3 bed · 2 bath · 1,500–2,500 sq ft";

export type PricingScenario = {
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  /** Preferred band keys when an engine prices by band; derived from sqft when omitted. */
  sqftBandKeys?: readonly string[];
  hours: number;
  conditionKey: string;
  propertyTypeKey: string;
  debrisKey: string;
  /** Selected add-on keys; applied only when a site config defines a match. */
  addonKeys: string[];
};

export const DEFAULT_SCENARIO: PricingScenario = {
  bedrooms: REFERENCE_BASKET.bedrooms,
  bathrooms: REFERENCE_BASKET.bathrooms,
  squareFeet: REFERENCE_BASKET.squareFeet,
  sqftBandKeys: REFERENCE_BASKET.sqftBandKeys,
  hours: REFERENCE_BASKET.hours,
  conditionKey: REFERENCE_BASKET.conditionKey,
  propertyTypeKey: REFERENCE_BASKET.propertyTypeKey,
  debrisKey: REFERENCE_BASKET.debrisKey,
  addonKeys: [],
};

export type BasketEntry = {
  /** Dollars. Cent-based engines are converted before they get here. */
  price: number;
  /**
   * `computed` ran the site's formula against the reference property.
   * `from` is an advertised "starting at" price and is not directly comparable.
   */
  kind: "computed" | "from";
  /** The site's own service key that produced this price. */
  sourceKey: string;
  note?: string;
};

export type SiteBasket = {
  entries: Partial<Record<CanonicalService, BasketEntry>>;
  /** Canonical services the site's config says it sells. */
  marketed: CanonicalService[];
  /** Marketed with no price path — the calculator cannot quote these. */
  gaps: CanonicalService[];
};

/** Final basket prices: nearest $5 whole dollars (no cents like 280.80). */
function roundMoney(n: number) {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n / 5) * 5;
}

/** Cheapest wins when several of a site's services map to one canonical key. */
function put(
  entries: Partial<Record<CanonicalService, BasketEntry>>,
  key: CanonicalService,
  entry: BasketEntry
) {
  const price = roundMoney(entry.price);
  const existing = entries[key];
  if (existing && existing.price <= price) return;
  entries[key] = { ...entry, price };
}

/**
 * Derive preferred band keys from raw square footage so custom scenarios still
 * hit the right multiplier on band-based engines.
 */
export function sqftBandKeysFor(squareFeet: number): string[] {
  const sqft = Math.max(0, squareFeet);
  if (sqft < 1000) return ["under-1000", "under-1500"];
  if (sqft < 1500) return ["1000-1500", "under-1500"];
  if (sqft < 2500) return ["1500-2500"];
  if (sqft < 4000) return ["2500-4000", "2500-3500"];
  return ["4000-plus", "3500-plus"];
}

export function scenarioFromInputs(partial: {
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  hours?: number;
  conditionKey?: string;
  propertyTypeKey?: string;
  debrisKey?: string;
  addonKeys?: string[];
}): PricingScenario {
  return {
    bedrooms: partial.bedrooms,
    bathrooms: partial.bathrooms,
    squareFeet: partial.squareFeet,
    sqftBandKeys: sqftBandKeysFor(partial.squareFeet),
    hours: partial.hours ?? DEFAULT_SCENARIO.hours,
    conditionKey: partial.conditionKey ?? DEFAULT_SCENARIO.conditionKey,
    propertyTypeKey:
      partial.propertyTypeKey ?? DEFAULT_SCENARIO.propertyTypeKey,
    debrisKey: partial.debrisKey ?? DEFAULT_SCENARIO.debrisKey,
    addonKeys: partial.addonKeys ?? [],
  };
}

export function scenarioLabel(scenario: PricingScenario): string {
  const beds = `${scenario.bedrooms} bed`;
  const baths = `${scenario.bathrooms} bath`;
  const sqft = `${scenario.squareFeet.toLocaleString("en-US")} sq ft`;
  const addons =
    scenario.addonKeys.length > 0
      ? ` · ${scenario.addonKeys.length} add-on${scenario.addonKeys.length === 1 ? "" : "s"}`
      : "";
  return `${beds} · ${baths} · ${sqft}${addons}`;
}

function pickBandKey(
  bands: { key: string }[],
  preferred: readonly string[]
): string {
  for (const key of preferred) {
    if (bands.some((b) => b.key === key)) return key;
  }
  return bands[Math.floor(bands.length / 2)]?.key ?? "";
}

function bandKeysForScenario(scenario: PricingScenario): readonly string[] {
  return scenario.sqftBandKeys ?? sqftBandKeysFor(scenario.squareFeet);
}

function multiplierFor(
  rows: { key: string; multiplier: number }[],
  key: string,
  fallback = 1
) {
  return rows.find((r) => r.key === key)?.multiplier ?? fallback;
}

function valueFor(
  rows: { key: string; value: number }[],
  key: string,
  fallback = 0
) {
  return rows.find((r) => r.key === key)?.value ?? fallback;
}

function marketedFrom(services: ServiceMapping): CanonicalService[] {
  const seen = new Set<CanonicalService>();
  for (const s of services) {
    if (s.enabled) seen.add(s.canonicalKey);
  }
  return [...seen];
}

/**
 * The most aggressive recurring discount a site offers, used to price the
 * `recurring` row as a per-visit figure on the site's most frequent plan.
 */
function bestRecurring(
  rows: { key: string; label: string; multiplier: number }[]
) {
  const recurring = rows.filter(
    (r) => r.key !== "one-time" && r.key !== "One-time"
  );
  if (recurring.length === 0) return null;
  return recurring.reduce((best, r) =>
    r.multiplier < best.multiplier ? r : best
  );
}

function normalizeAddonToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Slug used when an engine only exposes a display name (inline-wizard extras). */
export function slugifyAddonName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function addonItemMatches(
  selectedKey: string,
  item: { key?: string; label?: string; name?: string }
): boolean {
  const selected = normalizeAddonToken(selectedKey);
  if (!selected) return false;
  const key = normalizeAddonToken(item.key ?? "");
  const label = normalizeAddonToken(item.label ?? item.name ?? "");
  const slug = normalizeAddonToken(slugifyAddonName(item.name ?? item.key ?? ""));
  if (key === selected || label === selected || slug === selected) return true;
  // "windows" matches "windows interior" / "windows exterior" labels.
  if (label.startsWith(selected + " ") || label.includes(" " + selected + " ")) {
    return true;
  }
  if (key.startsWith(selected + " ") || slug.startsWith(selected + " ")) {
    return true;
  }
  return false;
}

/** Sum of selected add-ons defined on this config, in dollars. */
function addonDollarsForConfig(
  config: PricingConfig,
  addonKeys: string[]
): number {
  if (addonKeys.length === 0) return 0;
  let total = 0;
  const seen = new Set<string>();

  const take = (id: string, dollars: number) => {
    if (seen.has(id) || !Number.isFinite(dollars) || dollars <= 0) return;
    seen.add(id);
    total += dollars;
  };

  switch (config.kind) {
    case "bedroom-band":
    case "room-plus-sqft":
    case "sqft-rate-min":
      for (const addon of config.addOns) {
        for (const key of addonKeys) {
          if (addonItemMatches(key, addon)) {
            take(addon.key, addon.price);
            break;
          }
        }
      }
      break;
    case "service-base-mult":
      for (const addon of config.addonCents) {
        for (const key of addonKeys) {
          if (addonItemMatches(key, addon)) {
            take(addon.key, addon.cents / 100);
            break;
          }
        }
      }
      break;
    case "inline-wizard":
      for (const extra of config.extras) {
        const id = slugifyAddonName(extra.name);
        for (const key of addonKeys) {
          if (addonItemMatches(key, { key: id, name: extra.name })) {
            take(id, extra.price);
            break;
          }
        }
      }
      break;
    default:
      break;
  }

  return total;
}

function applyAddons(
  entries: SiteBasket["entries"],
  addonDollars: number,
  addonCount: number
): SiteBasket["entries"] {
  if (addonDollars <= 0 || addonCount <= 0) return entries;
  const note = `+${addonCount} add-on${addonCount === 1 ? "" : "s"}`;
  const next: SiteBasket["entries"] = { ...entries };
  for (const key of ADDON_SERVICES) {
    const entry = next[key];
    if (!entry || entry.kind !== "computed") continue;
    next[key] = {
      ...entry,
      price: entry.price + addonDollars,
      note: entry.note ? `${entry.note}; ${note}` : note,
    };
  }
  return next;
}

// --- bedroom-band: Winter Haven, Deltona, Haines City ----------------------

function bedroomBandBasket(
  config: BedroomBandConfig,
  scenario: PricingScenario
): SiteBasket {
  const { bedrooms, bathrooms } = scenario;
  const bandKey = pickBandKey(config.sqftBands, bandKeysForScenario(scenario));
  const bandMultiplier = multiplierFor(config.sqftBands, bandKey);
  const extraBaths = Math.max(0, bathrooms - 1) * config.bathRate;

  const cappedBeds = Math.min(Math.max(bedrooms, 0), config.maxBedrooms);
  const bedBase =
    config.bedroomBase.find((b) => b.bedrooms === cappedBeds)?.price ?? 119;

  const residentialBase = (bedBase + extraBaths) * bandMultiplier;
  const commercialBase = valueFor(config.commercialByBand, bandKey) + extraBaths;
  const postBase = valueFor(config.postByBand, bandKey);

  const round = (n: number) =>
    config.roundToNearest > 0
      ? Math.round(n / config.roundToNearest) * config.roundToNearest
      : n;

  const level = (key: string) => multiplierFor(config.levelMultipliers, key);

  const entries: SiteBasket["entries"] = {};
  put(entries, "standard", {
    price: round(residentialBase * level("standard")),
    kind: "computed",
    sourceKey: "residential-standard",
  });
  put(entries, "deep", {
    price: round(residentialBase * level("deep")),
    kind: "computed",
    sourceKey: "residential-deep",
  });
  put(entries, "move-in-out", {
    price: round(residentialBase * level("move")),
    kind: "computed",
    sourceKey: "residential-move",
  });
  put(entries, "commercial-office", {
    price: round(commercialBase * level("standard")),
    kind: "computed",
    sourceKey: "commercial",
    note: `${bathrooms} restrooms`,
  });
  put(entries, "post-construction", {
    price: round(postBase * level("post")),
    kind: "computed",
    sourceKey: "post-construction",
  });

  return finish(entries, config.services, config, scenario);
}

// --- service-base-mult: Windermere ----------------------------------------

function serviceBaseMultBasket(
  config: ServiceBaseMultConfig,
  scenario: PricingScenario
): SiteBasket {
  const { bedrooms, bathrooms } = scenario;
  const bandKey = pickBandKey(
    config.sqftMultipliers,
    bandKeysForScenario(scenario)
  );
  const sqftMultiplier = multiplierFor(config.sqftMultipliers, bandKey);
  const propertyMultiplier = multiplierFor(
    config.propertyMultipliers,
    scenario.propertyTypeKey
  );
  const rooms =
    bedrooms * config.bedroomCents + bathrooms * config.bathroomCents;

  const priceCents = (serviceKey: string, frequencyMultiplier: number) => {
    const base = valueFor(config.serviceBaseCents, serviceKey);
    const applies = config.frequencyServices.includes(serviceKey);
    return (
      (base + rooms) *
      propertyMultiplier *
      sqftMultiplier *
      (applies ? frequencyMultiplier : 1)
    );
  };

  const entries: SiteBasket["entries"] = {};
  for (const service of config.services) {
    if (!service.enabled) continue;
    if (service.canonicalKey === "recurring") continue;
    put(entries, service.canonicalKey, {
      price: priceCents(service.key, 1) / 100,
      kind: "computed",
      sourceKey: service.key,
    });
  }

  const recurring = bestRecurring(config.frequencyMultipliers);
  const recurringService = config.frequencyServices[0];
  if (recurring && recurringService) {
    put(entries, "recurring", {
      price: priceCents(recurringService, recurring.multiplier) / 100,
      kind: "computed",
      sourceKey: recurringService,
      note: `${recurring.label} per visit`,
    });
  }

  return finish(entries, config.services, config, scenario);
}

// --- room-plus-sqft: Apopka -----------------------------------------------

function roomPlusSqftBasket(
  config: RoomPlusSqftConfig,
  scenario: PricingScenario
): SiteBasket {
  const { bedrooms, bathrooms, squareFeet } = scenario;

  const subtotalFor = (key: string) => {
    const rate = config.serviceRates.find((r) => r.key === key);
    if (!rate) return null;
    const roomCost =
      rate.baseRate +
      bedrooms * rate.perBedroom +
      bathrooms * rate.perBathroom +
      Math.max(0, squareFeet - config.freeSqFt) * rate.perSqFt;
    return { subtotal: Math.round(roomCost), startingAt: rate.startingAt };
  };

  const totalFor = (key: string, discount: number) => {
    const parts = subtotalFor(key);
    if (!parts) return null;
    const off = Math.round(parts.subtotal * discount);
    return Math.max(parts.subtotal - off, parts.startingAt);
  };

  const entries: SiteBasket["entries"] = {};
  for (const service of config.services) {
    if (!service.enabled) continue;
    const price = totalFor(service.key, 0);
    if (price === null) continue;
    put(entries, service.canonicalKey, {
      price,
      kind: "computed",
      sourceKey: service.key,
    });
  }

  // Recurring is a frequency discount on the standard clean, not its own service.
  const best = config.frequencies
    .filter((f) => f.discount > 0)
    .reduce<(typeof config.frequencies)[number] | null>(
      (acc, f) => (!acc || f.discount > acc.discount ? f : acc),
      null
    );
  const standardKey = config.services.find(
    (s) => s.canonicalKey === "standard" && s.enabled
  )?.key;
  if (best && standardKey) {
    const price = totalFor(standardKey, best.discount);
    if (price !== null) {
      put(entries, "recurring", {
        price,
        kind: "computed",
        sourceKey: standardKey,
        note: `${best.label} per visit`,
      });
    }
  }

  return finish(entries, config.services, config, scenario);
}

// --- band-lookup-range: Kissimmee ----------------------------------------

function bandLookupRangeBasket(
  config: BandLookupRangeConfig,
  scenario: PricingScenario
): SiteBasket {
  const { bedrooms, bathrooms, squareFeet } = scenario;

  const beds = valueFor(config.bedroomAddon, String(bedrooms), 40);
  const baths = valueFor(config.bathroomAddon, String(bathrooms), 30);

  let sqftExtra = 0;
  if (squareFeet > config.sqftThreshold) {
    sqftExtra =
      Math.round((squareFeet - config.sqftThreshold) / config.sqftStep) *
      config.sqftStepPrice;
  }

  const midFor = (key: string, multiplier: number) => {
    const base = config.basePrices.find((b) => b.key === key);
    if (!base) return null;
    return Math.round((base.value + beds + baths + sqftExtra) * multiplier);
  };

  const entries: SiteBasket["entries"] = {};
  for (const service of config.services) {
    if (!service.enabled) continue;
    if (service.canonicalKey === "recurring") continue;
    const price = midFor(service.key, 1);
    if (price === null) continue;
    put(entries, service.canonicalKey, {
      price,
      kind: "computed",
      sourceKey: service.key,
      note: "midpoint of quoted range",
    });
  }

  const recurringService = config.services.find(
    (s) => s.canonicalKey === "recurring" && s.enabled
  );
  const best = bestRecurring(config.frequencyMultipliers);
  if (recurringService) {
    const price = midFor(recurringService.key, best?.multiplier ?? 1);
    if (price !== null) {
      put(entries, "recurring", {
        price,
        kind: "computed",
        sourceKey: recurringService.key,
        note: best ? `${best.label} per visit` : undefined,
      });
    }
  }

  return finish(entries, config.services, config, scenario);
}

// --- sqft-rate-min: Davenport --------------------------------------------

function sqftRateMinBasket(
  config: SqftRateMinConfig,
  scenario: PricingScenario
): SiteBasket {
  const { bedrooms, bathrooms } = scenario;
  const sqft = Math.max(
    config.minSqft,
    Math.min(config.maxSqft, scenario.squareFeet)
  );
  const rooms = bedrooms * config.bedroomRate + bathrooms * config.bathroomRate;

  const totalFor = (key: string, multiplier: number) => {
    const rate = config.serviceRates.find((r) => r.key === key);
    if (!rate) return null;
    const base = Math.max(rate.minBase, Math.round(sqft * rate.perSqft));
    return Math.round((base + rooms) * multiplier);
  };

  const entries: SiteBasket["entries"] = {};
  for (const service of config.services) {
    if (!service.enabled) continue;
    if (service.canonicalKey === "recurring") continue;
    const price = totalFor(service.key, 1);
    if (price === null) continue;
    put(entries, service.canonicalKey, {
      price,
      kind: "computed",
      sourceKey: service.key,
    });
  }

  const recurringService = config.services.find(
    (s) => s.canonicalKey === "recurring" && s.enabled
  );
  const best = bestRecurring(config.frequencyMultipliers);
  if (recurringService) {
    const price = totalFor(recurringService.key, best?.multiplier ?? 1);
    if (price !== null) {
      put(entries, "recurring", {
        price,
        kind: "computed",
        sourceKey: recurringService.key,
        note: best ? `${best.label} per visit` : undefined,
      });
    }
  }

  return finish(entries, config.services, config, scenario);
}

// --- per-service-branch: Cleaning Weekly ---------------------------------

function perServiceBranchBasket(
  config: PerServiceBranchConfig,
  scenario: PricingScenario
): SiteBasket {
  const { bedrooms, bathrooms, squareFeet } = scenario;
  const blocks = (included: number, per: number) =>
    Math.max(0, Math.ceil((squareFeet - included) / 500)) * per;

  const home = config.homeCleaning;
  const homeWeeklyMultiplier =
    home.frequencyMultipliers.find((f) => f.key === "weekly")?.multiplier ?? 1;
  const homeSubtotal =
    home.base +
    Math.max(0, bedrooms - home.includedBedrooms) * home.perBed +
    Math.max(0, bathrooms - home.includedBathrooms) * home.perBath +
    blocks(home.includedSqFt, home.per500SqFt);
  const homeWeekly = homeSubtotal * homeWeeklyMultiplier;

  const office = config.officeCleaning;
  const officeWeeklyMultiplier =
    office.frequencyMultipliers.find((f) => f.key === "weekly")?.multiplier ??
    1;
  const officeSubtotal =
    office.base +
    blocks(office.includedSqFt, office.per500SqFt) +
    Math.max(0, bathrooms - office.includedRestrooms) * office.perRestroom;

  const move = config.moveInOut;
  const moveTotal =
    move.base +
    Math.max(0, bedrooms - move.includedBedrooms) * move.perBed +
    Math.max(0, bathrooms - move.includedBathrooms) * move.perBath +
    blocks(move.includedSqFt, move.per500SqFt);

  const post = config.postConstruction;
  const postTotal =
    (post.base + blocks(post.includedSqFt, post.per500SqFt)) *
    multiplierFor(post.debrisMultipliers, scenario.debrisKey);

  const air = config.airbnbTurnover;
  const airTotal =
    air.base +
    Math.max(0, bedrooms - air.includedBedrooms) * air.perBed +
    Math.max(0, bathrooms - air.includedBathrooms) * air.perBath;

  const entries: SiteBasket["entries"] = {};
  put(entries, "recurring", {
    price: homeWeekly,
    kind: "computed",
    sourceKey: "home-cleaning",
    note: "Weekly per visit",
  });
  put(entries, "deep", {
    price: homeWeekly * config.deepCleaningMultiplier,
    kind: "computed",
    sourceKey: "deep-cleaning",
  });
  put(entries, "commercial-office", {
    price: officeSubtotal * officeWeeklyMultiplier,
    kind: "computed",
    sourceKey: "office-cleaning",
    note: "Weekly per visit",
  });
  put(entries, "move-in-out", {
    price: moveTotal,
    kind: "computed",
    sourceKey: "move-in-out",
  });
  put(entries, "post-construction", {
    price: postTotal,
    kind: "computed",
    sourceKey: "post-construction",
    note: `${scenario.debrisKey} debris`,
  });
  put(entries, "airbnb-turnover", {
    price: airTotal,
    kind: "computed",
    sourceKey: "airbnb-turnover",
  });

  return finish(entries, config.services, config, scenario);
}

// --- inline-wizard: Sanford ----------------------------------------------

function inlineWizardBasket(
  config: InlineWizardConfig,
  scenario: PricingScenario
): SiteBasket {
  const { bedrooms, bathrooms, squareFeet, hours } = scenario;
  const sqftBlocks = Math.max(
    0,
    Math.ceil((squareFeet - config.includedSqFt) / 1000)
  );

  const standard =
    config.standardBase +
    sqftBlocks * config.per1000SqFtOver +
    Math.max(0, bedrooms - 1) * config.perBedroomOver +
    Math.max(0, bathrooms - 1) * config.perBathroomOver;

  const moveOut =
    config.moveOut.base +
    sqftBlocks * config.moveOut.per1000SqFtOver +
    Math.max(0, bedrooms - 1) * config.moveOut.perBedroomOver +
    Math.max(0, bathrooms - 1) * config.moveOut.perBathroomOver +
    (config.conditionSurcharges.find((c) => c.key === scenario.conditionKey)
      ?.price ?? 0);

  const cheapestMaintenance = config.maintenance.byFrequency.reduce<
    { key: string; value: number } | null
  >((best, row) => (!best || row.value < best.value ? row : best), null);
  const maintenance =
    cheapestMaintenance === null
      ? null
      : cheapestMaintenance.value +
        sqftBlocks * config.maintenance.per1000SqFt +
        Math.max(0, bedrooms - 1) * config.maintenance.perBedroom +
        Math.max(0, bathrooms - 1) * config.maintenance.perBathroom;

  const discounted = (n: number) => n * config.discountMultiplier;

  const entries: SiteBasket["entries"] = {};
  for (const service of config.services) {
    if (!service.enabled) continue;
    if (service.canonicalKey === "hourly") {
      put(entries, "hourly", {
        price: discounted(config.hourlyRate * hours),
        kind: "computed",
        sourceKey: service.key,
        note: `${hours} hours at $${config.hourlyRate}/hr`,
      });
      continue;
    }
    if (service.canonicalKey === "move-in-out") {
      put(entries, "move-in-out", {
        price: discounted(moveOut),
        kind: "computed",
        sourceKey: service.key,
        note: `${scenario.conditionKey.toLowerCase()} condition`,
      });
      continue;
    }
    if (service.canonicalKey === "recurring") {
      if (maintenance !== null) {
        put(entries, "recurring", {
          price: discounted(maintenance),
          kind: "computed",
          sourceKey: service.key,
          note: `${cheapestMaintenance?.key} per visit`,
        });
      }
      continue;
    }
    // Deep and post-construction fall through to the standard base.
    put(entries, service.canonicalKey, {
      price: discounted(standard),
      kind: "computed",
      sourceKey: service.key,
      note: "same base as a standard clean",
    });
  }

  return finish(entries, config.services, config, scenario);
}

// --- headline-only: Celebration ------------------------------------------

function headlineOnlyBasket(config: HeadlineOnlyConfig): SiteBasket {
  const entries: SiteBasket["entries"] = {};
  for (const service of config.services) {
    if (!service.enabled) continue;
    const headline = config.headlines.find((h) => h.key === service.key);
    if (!headline) continue;
    put(entries, service.canonicalKey, {
      price: headline.fromPrice,
      kind: "from",
      sourceKey: service.key,
      note: "advertised starting price",
    });
  }
  return finish(entries, config.services);
}

function finish(
  entries: SiteBasket["entries"],
  services: ServiceMapping,
  config?: PricingConfig,
  scenario?: PricingScenario
): SiteBasket {
  let next = entries;
  if (config && scenario && scenario.addonKeys.length > 0) {
    const dollars = addonDollarsForConfig(config, scenario.addonKeys);
    // Count how many selected keys actually matched something on this config.
    const matchedCount = scenario.addonKeys.filter((key) => {
      switch (config.kind) {
        case "bedroom-band":
        case "room-plus-sqft":
        case "sqft-rate-min":
          return config.addOns.some((a) => addonItemMatches(key, a));
        case "service-base-mult":
          return config.addonCents.some((a) => addonItemMatches(key, a));
        case "inline-wizard":
          return config.extras.some((e) =>
            addonItemMatches(key, {
              key: slugifyAddonName(e.name),
              name: e.name,
            })
          );
        default:
          return false;
      }
    }).length;
    next = applyAddons(next, dollars, matchedCount);
  }

  // Re-round after add-ons so totals stay on the $5 grid.
  for (const key of Object.keys(next) as CanonicalService[]) {
    const entry = next[key];
    if (entry) next[key] = { ...entry, price: roundMoney(entry.price) };
  }

  const marketed = marketedFrom(services);
  const gaps = marketed.filter((key) => next[key] === undefined);
  return { entries: next, marketed, gaps };
}

export function computeBasket(
  config: PricingConfig,
  scenario: PricingScenario = DEFAULT_SCENARIO
): SiteBasket {
  const resolved: PricingScenario = {
    ...scenario,
    sqftBandKeys: scenario.sqftBandKeys ?? sqftBandKeysFor(scenario.squareFeet),
    addonKeys: scenario.addonKeys ?? [],
  };

  switch (config.kind) {
    case "bedroom-band":
      return bedroomBandBasket(config, resolved);
    case "service-base-mult":
      return serviceBaseMultBasket(config, resolved);
    case "room-plus-sqft":
      return roomPlusSqftBasket(config, resolved);
    case "band-lookup-range":
      return bandLookupRangeBasket(config, resolved);
    case "sqft-rate-min":
      return sqftRateMinBasket(config, resolved);
    case "per-service-branch":
      return perServiceBranchBasket(config, resolved);
    case "inline-wizard":
      return inlineWizardBasket(config, resolved);
    case "headline-only":
      return headlineOnlyBasket(config);
  }
}

export function computeReferenceBasket(config: PricingConfig): SiteBasket {
  return computeBasket(config, DEFAULT_SCENARIO);
}

/** Collect unique add-on options across configs for the calculator UI. */
export function collectAddonCatalog(
  configs: PricingConfig[]
): { key: string; label: string }[] {
  const byKey = new Map<string, string>();

  for (const config of configs) {
    switch (config.kind) {
      case "bedroom-band":
      case "room-plus-sqft":
      case "sqft-rate-min":
        for (const addon of config.addOns) {
          if (!byKey.has(addon.key)) byKey.set(addon.key, addon.label);
        }
        break;
      case "service-base-mult":
        for (const addon of config.addonCents) {
          if (!byKey.has(addon.key)) byKey.set(addon.key, addon.label);
        }
        break;
      case "inline-wizard":
        for (const extra of config.extras) {
          const key = slugifyAddonName(extra.name);
          if (!byKey.has(key)) byKey.set(key, extra.name);
        }
        break;
      default:
        break;
    }
  }

  return [...byKey.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
