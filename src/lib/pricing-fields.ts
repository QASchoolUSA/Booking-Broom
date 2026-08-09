import type { PricingConfig } from "convex/lib/pricingConfigs";

/**
 * Turns a pricing config into a flat list of editable fields.
 *
 * Every engine stores different numbers, but they are all just numbers on a
 * path, so one editor component can drive all eight as long as each engine can
 * describe its own shape. Labels come from the data itself, which keeps the
 * form in step with whatever bands and add-ons a site currently has.
 */

export type PricingFieldKind =
  /** Whole dollars. */
  | "money"
  /** Stored in cents, edited in dollars. */
  | "cents"
  /** Dollars with cents, e.g. $8.20 per bathroom. */
  | "money2"
  /** Dollars per square foot, e.g. 0.12. */
  | "rate"
  /** Bare multiplier, e.g. 1.4. */
  | "multiplier"
  /** Stored as a fraction, edited as a percentage. */
  | "percent"
  | "int"
  | "text";

export interface PricingField {
  path: (string | number)[];
  label: string;
  kind: PricingFieldKind;
  hint?: string;
}

export interface PricingFieldGroup {
  title: string;
  description?: string;
  fields: PricingField[];
}

export function getAtPath(obj: unknown, path: (string | number)[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

/** Returns a copy with `path` replaced; the original is never mutated. */
export function setAtPath<T>(
  root: T,
  path: (string | number)[],
  value: number | string
): T {
  const clone = structuredClone(root);
  let target: Record<string | number, unknown> = clone as Record<
    string | number,
    unknown
  >;
  for (const key of path.slice(0, -1)) {
    target = target[key] as Record<string | number, unknown>;
  }
  target[path[path.length - 1]] = value;
  return clone;
}

/** How many described fields differ between two configs. */
export function countChangedFields(
  before: PricingConfig,
  after: PricingConfig
): number {
  let changed = 0;
  for (const group of describePricingConfig(after)) {
    for (const field of group.fields) {
      if (getAtPath(before, field.path) !== getAtPath(after, field.path)) {
        changed += 1;
      }
    }
  }
  return changed;
}

export function fieldToDisplay(kind: PricingFieldKind, value: number): number {
  if (kind === "cents") return value / 100;
  if (kind === "percent") return Math.round(value * 1000) / 10;
  return value;
}

export function fieldFromDisplay(
  kind: PricingFieldKind,
  value: number
): number {
  if (kind === "cents") return Math.round(value * 100);
  if (kind === "percent") return Math.round(value * 10) / 1000;
  return value;
}

export function fieldStep(kind: PricingFieldKind): number {
  switch (kind) {
    case "rate":
      return 0.005;
    case "multiplier":
      return 0.01;
    case "money2":
      return 0.1;
    case "percent":
      return 1;
    default:
      return 1;
  }
}

export function fieldPrefix(kind: PricingFieldKind): string | null {
  switch (kind) {
    case "money":
    case "money2":
    case "cents":
    case "rate":
      return "$";
    case "multiplier":
      return "×";
    default:
      return null;
  }
}

export function fieldSuffix(kind: PricingFieldKind): string | null {
  if (kind === "percent") return "%";
  if (kind === "rate") return "/ sq ft";
  return null;
}

function bedroomLabel(bedrooms: number) {
  return bedrooms === 0 ? "Studio" : `${bedrooms} bedroom`;
}

export function describePricingConfig(
  config: PricingConfig
): PricingFieldGroup[] {
  switch (config.kind) {
    case "bedroom-band": {
      const bandLabel = (key: string) =>
        config.sqftBands.find((b) => b.key === key)?.label ?? key;
      return [
        {
          title: "Standard clean by bedrooms",
          description:
            "Price for a one-bathroom home in the anchor size band, before multipliers.",
          fields: config.bedroomBase.map((row, i) => ({
            path: ["bedroomBase", i, "price"],
            label: bedroomLabel(row.bedrooms),
            kind: "money" as const,
          })),
        },
        {
          title: "Size band multipliers",
          description:
            "Scales Standard and related quotes up or down by home size.",
          fields: config.sqftBands.map((band, i) => ({
            path: ["sqftBands", i, "multiplier"],
            label: band.label,
            kind: "multiplier" as const,
          })),
        },
        {
          title: "Service level multipliers",
          description:
            "Deep and other levels are priced as a multiple of the standard clean.",
          fields: config.levelMultipliers.map((level, i) => ({
            path: ["levelMultipliers", i, "multiplier"],
            label: level.label,
            kind: "multiplier" as const,
          })),
        },
        {
          title: "Commercial by size band",
          description: "Flat commercial quotes by the same size bands.",
          fields: config.commercialByBand.map((row, i) => ({
            path: ["commercialByBand", i, "value"],
            label: bandLabel(row.key),
            kind: "money" as const,
          })),
        },
        {
          title: "Post-construction by size band",
          fields: config.postByBand.map((row, i) => ({
            path: ["postByBand", i, "value"],
            label: bandLabel(row.key),
            kind: "money" as const,
          })),
        },
        {
          title: "Add-ons",
          fields: config.addOns.flatMap((addOn, i) => [
            {
              path: ["addOns", i, "price"],
              label: addOn.label,
              kind: "money" as const,
            },
            {
              path: ["addOns", i, "label"],
              label: `${addOn.label} — name shown on site`,
              kind: "text" as const,
            },
          ]),
        },
        {
          title: "Rules",
          fields: [
            {
              path: ["bathRate"],
              label: "Each bathroom past the first",
              kind: "money",
            },
            {
              path: ["roundToNearest"],
              label: "Round the total to the nearest",
              kind: "money",
            },
            {
              path: ["rangeSpread"],
              label: "Quoted range either side of the price",
              kind: "percent",
            },
            { path: ["maxBedrooms"], label: "Most bedrooms offered", kind: "int" },
            {
              path: ["maxBathrooms"],
              label: "Most bathrooms offered",
              kind: "int",
            },
          ],
        },
      ];
    }

    case "service-base-mult": {
      const serviceLabel = (key: string) =>
        config.services.find((s) => s.key === key)?.label ?? key;
      return [
        {
          title: "Service base prices",
          fields: config.serviceBaseCents.map((row, i) => ({
            path: ["serviceBaseCents", i, "value"],
            label: serviceLabel(row.key),
            kind: "cents" as const,
          })),
        },
        {
          title: "Property type multipliers",
          fields: config.propertyMultipliers.map((row, i) => ({
            path: ["propertyMultipliers", i, "multiplier"],
            label: row.label,
            kind: "multiplier" as const,
          })),
        },
        {
          title: "Size band multipliers",
          fields: config.sqftMultipliers.map((row, i) => ({
            path: ["sqftMultipliers", i, "multiplier"],
            label: row.label,
            kind: "multiplier" as const,
          })),
        },
        {
          title: "Frequency multipliers",
          description: "Only applied to house and apartment cleaning.",
          fields: config.frequencyMultipliers.map((row, i) => ({
            path: ["frequencyMultipliers", i, "multiplier"],
            label: row.label,
            kind: "multiplier" as const,
          })),
        },
        {
          title: "Rooms",
          fields: [
            { path: ["bedroomCents"], label: "Per bedroom", kind: "cents" },
            { path: ["bathroomCents"], label: "Per bathroom", kind: "cents" },
          ],
        },
        {
          title: "Add-ons",
          fields: config.addonCents.flatMap((addOn, i) => [
            {
              path: ["addonCents", i, "cents"],
              label: addOn.label,
              kind: "cents" as const,
            },
            {
              path: ["addonCents", i, "label"],
              label: `${addOn.label} — name shown on site`,
              kind: "text" as const,
            },
          ]),
        },
      ];
    }

    case "room-plus-sqft": {
      const serviceLabel = (key: string) =>
        config.services.find((s) => s.key === key)?.label ?? key;
      return [
        ...config.serviceRates.map((rate, i) => ({
          title: serviceLabel(rate.key),
          fields: [
            {
              path: ["serviceRates", i, "baseRate"],
              label: "Base rate",
              kind: "money" as const,
            },
            {
              path: ["serviceRates", i, "perBedroom"],
              label: "Per bedroom",
              kind: "money" as const,
            },
            {
              path: ["serviceRates", i, "perBathroom"],
              label: "Per bathroom",
              kind: "money" as const,
            },
            {
              path: ["serviceRates", i, "perSqFt"],
              label: "Per extra square foot",
              kind: "rate" as const,
            },
            {
              path: ["serviceRates", i, "startingAt"],
              label: "Advertised from price (also the discount floor)",
              kind: "money" as const,
            },
          ],
        })),
        {
          title: "Frequency discounts",
          fields: config.frequencies.map((freq, i) => ({
            path: ["frequencies", i, "discount"],
            label: freq.label,
            kind: "percent" as const,
          })),
        },
        {
          title: "Add-ons",
          fields: config.addOns.flatMap((addOn, i) => [
            {
              path: ["addOns", i, "price"],
              label: addOn.label,
              kind: "money" as const,
            },
            {
              path: ["addOns", i, "label"],
              label: `${addOn.label} — name shown on site`,
              kind: "text" as const,
            },
          ]),
        },
        {
          title: "Rules",
          fields: [
            {
              path: ["freeSqFt"],
              label: "Square footage included in the base rate",
              kind: "int",
            },
          ],
        },
      ];
    }

    case "band-lookup-range": {
      const serviceLabel = (key: string) =>
        config.services.find((s) => s.key === key)?.label ?? key;
      return [
        {
          title: "Service base prices",
          fields: config.basePrices.map((row, i) => ({
            path: ["basePrices", i, "value"],
            label: serviceLabel(row.key),
            kind: "money" as const,
          })),
        },
        {
          title: "Bedroom surcharge",
          fields: config.bedroomAddon.map((row, i) => ({
            path: ["bedroomAddon", i, "value"],
            label: row.key === "Studio" ? "Studio" : `${row.key} bedrooms`,
            kind: "money" as const,
          })),
        },
        {
          title: "Bathroom surcharge",
          fields: config.bathroomAddon.map((row, i) => ({
            path: ["bathroomAddon", i, "value"],
            label: `${row.key} bathrooms`,
            kind: "money" as const,
          })),
        },
        {
          title: "Frequency multipliers",
          fields: config.frequencyMultipliers.map((row, i) => ({
            path: ["frequencyMultipliers", i, "multiplier"],
            label: row.label,
            kind: "multiplier" as const,
          })),
        },
        {
          title: "Large homes",
          fields: [
            {
              path: ["sqftThreshold"],
              label: "Surcharge starts above",
              kind: "int",
            },
            {
              path: ["sqftStep"],
              label: "Charged every this many sq ft",
              kind: "int",
            },
            { path: ["sqftStepPrice"], label: "Per step", kind: "money" },
          ],
        },
        {
          title: "Quoted range",
          description: "The estimate is shown as a low-to-high band.",
          fields: [
            { path: ["rangeLow"], label: "Low end", kind: "multiplier" },
            { path: ["rangeHigh"], label: "High end", kind: "multiplier" },
          ],
        },
      ];
    }

    case "sqft-rate-min": {
      const serviceLabel = (key: string) =>
        config.services.find((s) => s.key === key)?.label ?? key;
      return [
        {
          title: "Service rates",
          description:
            "The base is square footage times the rate, never less than the minimum.",
          fields: config.serviceRates.flatMap((rate, i) => [
            {
              path: ["serviceRates", i, "perSqft"],
              label: `${serviceLabel(rate.key)} — per sq ft`,
              kind: "rate" as const,
            },
            {
              path: ["serviceRates", i, "minBase"],
              label: `${serviceLabel(rate.key)} — minimum`,
              kind: "money" as const,
            },
          ]),
        },
        {
          title: "Rooms",
          fields: [
            { path: ["bedroomRate"], label: "Per bedroom", kind: "money" },
            { path: ["bathroomRate"], label: "Per bathroom", kind: "money" },
          ],
        },
        {
          title: "Frequency multipliers",
          fields: config.frequencyMultipliers.map((row, i) => ({
            path: ["frequencyMultipliers", i, "multiplier"],
            label: row.label,
            kind: "multiplier" as const,
          })),
        },
        {
          title: "Add-ons",
          fields: config.addOns.flatMap((addOn, i) => [
            {
              path: ["addOns", i, "price"],
              label: addOn.label,
              kind: "money" as const,
            },
            {
              path: ["addOns", i, "label"],
              label: `${addOn.label} — name shown on site`,
              kind: "text" as const,
            },
          ]),
        },
        {
          title: "Size band midpoints",
          description:
            "Customers pick a band; the midpoint is what the estimate is built from.",
          fields: config.sqftPresets.map((preset, i) => ({
            path: ["sqftPresets", i, "value"],
            label: preset.label,
            kind: "int" as const,
          })),
        },
        {
          title: "Limits",
          fields: [
            { path: ["minSqft"], label: "Smallest job", kind: "int" },
            { path: ["maxSqft"], label: "Largest job", kind: "int" },
          ],
        },
      ];
    }

    case "per-service-branch":
      return [
        {
          title: "Home cleaning",
          description: "Weekly is the baseline; less frequent visits cost more.",
          fields: [
            { path: ["homeCleaning", "base"], label: "Base", kind: "money" },
            {
              path: ["homeCleaning", "perBed"],
              label: "Per extra bedroom",
              kind: "money",
            },
            {
              path: ["homeCleaning", "perBath"],
              label: "Per extra bathroom",
              kind: "money",
            },
            {
              path: ["homeCleaning", "per500SqFt"],
              label: "Per extra 500 sq ft",
              kind: "money",
            },
            {
              path: ["homeCleaning", "includedBedrooms"],
              label: "Bedrooms included",
              kind: "int",
            },
            {
              path: ["homeCleaning", "includedBathrooms"],
              label: "Bathrooms included",
              kind: "int",
            },
            {
              path: ["homeCleaning", "includedSqFt"],
              label: "Square feet included",
              kind: "int",
            },
            ...config.homeCleaning.frequencyMultipliers.map((row, i) => ({
              path: ["homeCleaning", "frequencyMultipliers", i, "multiplier"],
              label: row.label,
              kind: "multiplier" as const,
            })),
          ],
        },
        {
          title: "Office cleaning",
          fields: [
            { path: ["officeCleaning", "base"], label: "Base", kind: "money" },
            {
              path: ["officeCleaning", "per500SqFt"],
              label: "Per extra 500 sq ft",
              kind: "money",
            },
            {
              path: ["officeCleaning", "perRestroom"],
              label: "Per extra restroom",
              kind: "money",
            },
            {
              path: ["officeCleaning", "includedRestrooms"],
              label: "Restrooms included",
              kind: "int",
            },
            {
              path: ["officeCleaning", "includedSqFt"],
              label: "Square feet included",
              kind: "int",
            },
            ...config.officeCleaning.frequencyMultipliers.map((row, i) => ({
              path: ["officeCleaning", "frequencyMultipliers", i, "multiplier"],
              label: row.label,
              kind: "multiplier" as const,
            })),
          ],
        },
        {
          title: "Deep cleaning",
          description: "Applied to a weekly home clean.",
          fields: [
            {
              path: ["deepCleaningMultiplier"],
              label: "Multiplier",
              kind: "multiplier",
            },
          ],
        },
        {
          title: "Move in / move out",
          fields: [
            { path: ["moveInOut", "base"], label: "Base", kind: "money" },
            {
              path: ["moveInOut", "perBed"],
              label: "Per extra bedroom",
              kind: "money",
            },
            {
              path: ["moveInOut", "perBath"],
              label: "Per extra bathroom",
              kind: "money",
            },
            {
              path: ["moveInOut", "per500SqFt"],
              label: "Per extra 500 sq ft",
              kind: "money",
            },
            {
              path: ["moveInOut", "includedBedrooms"],
              label: "Bedrooms included",
              kind: "int",
            },
            {
              path: ["moveInOut", "includedBathrooms"],
              label: "Bathrooms included",
              kind: "int",
            },
            {
              path: ["moveInOut", "includedSqFt"],
              label: "Square feet included",
              kind: "int",
            },
          ],
        },
        {
          title: "Post-construction",
          fields: [
            { path: ["postConstruction", "base"], label: "Base", kind: "money" },
            {
              path: ["postConstruction", "per500SqFt"],
              label: "Per extra 500 sq ft",
              kind: "money",
            },
            {
              path: ["postConstruction", "includedSqFt"],
              label: "Square feet included",
              kind: "int",
            },
            ...config.postConstruction.debrisMultipliers.map((row, i) => ({
              path: ["postConstruction", "debrisMultipliers", i, "multiplier"],
              label: row.label,
              kind: "multiplier" as const,
            })),
          ],
        },
        {
          title: "Airbnb turnover",
          fields: [
            { path: ["airbnbTurnover", "base"], label: "Base", kind: "money" },
            {
              path: ["airbnbTurnover", "perBed"],
              label: "Per extra bedroom",
              kind: "money",
            },
            {
              path: ["airbnbTurnover", "perBath"],
              label: "Per extra bathroom",
              kind: "money",
            },
            {
              path: ["airbnbTurnover", "includedBedrooms"],
              label: "Bedrooms included",
              kind: "int",
            },
            {
              path: ["airbnbTurnover", "includedBathrooms"],
              label: "Bathrooms included",
              kind: "int",
            },
            {
              path: ["airbnbTurnover", "highVolumeMultiplier"],
              label: "High-volume multiplier",
              kind: "multiplier",
            },
            {
              path: ["airbnbTurnover", "highVolumeThreshold"],
              label: "Turnovers per month before it applies",
              kind: "int",
            },
          ],
        },
        {
          title: "Size band midpoints",
          fields: config.sqftBands.map((band, i) => ({
            path: ["sqftBands", i, "value"],
            label: band.label,
            kind: "int" as const,
          })),
        },
      ];

    case "inline-wizard":
      return [
        {
          title: "Standard, deep and post-construction",
          description:
            "These three services currently share one base price on this site.",
          fields: [
            { path: ["standardBase"], label: "Base", kind: "money" },
            {
              path: ["includedSqFt"],
              label: "Square feet included",
              kind: "int",
            },
            {
              path: ["per1000SqFtOver"],
              label: "Per extra 1,000 sq ft",
              kind: "money",
            },
            {
              path: ["perBedroomOver"],
              label: "Per bedroom past the first",
              kind: "money",
            },
            {
              path: ["perBathroomOver"],
              label: "Per bathroom past the first",
              kind: "money2",
            },
          ],
        },
        {
          title: "Move in / move out",
          fields: [
            { path: ["moveOut", "base"], label: "Base", kind: "money" },
            {
              path: ["moveOut", "per1000SqFtOver"],
              label: "Per extra 1,000 sq ft",
              kind: "money",
            },
            {
              path: ["moveOut", "perBedroomOver"],
              label: "Per bedroom past the first",
              kind: "money",
            },
            {
              path: ["moveOut", "perBathroomOver"],
              label: "Per bathroom past the first",
              kind: "money2",
            },
          ],
        },
        {
          title: "Property condition surcharge",
          description: "Only applied to move in / move out jobs.",
          fields: config.conditionSurcharges.map((row, i) => ({
            path: ["conditionSurcharges", i, "price"],
            label: row.label,
            kind: "money" as const,
          })),
        },
        {
          title: "Recurring maintenance per visit",
          fields: [
            ...config.maintenance.byFrequency.map((row, i) => ({
              path: ["maintenance", "byFrequency", i, "value"],
              label: row.key,
              kind: "money2" as const,
            })),
            {
              path: ["maintenance", "per1000SqFt"],
              label: "Per extra 1,000 sq ft",
              kind: "money",
            },
            {
              path: ["maintenance", "perBedroom"],
              label: "Per bedroom past the first",
              kind: "money",
            },
            {
              path: ["maintenance", "perBathroom"],
              label: "Per bathroom past the first",
              kind: "money2",
            },
          ],
        },
        {
          title: "Hourly",
          fields: [
            { path: ["hourlyRate"], label: "Per hour", kind: "money" },
          ],
        },
        {
          title: "Discount",
          description:
            "Applied to every estimate this site produces. 100% means no discount.",
          fields: [
            {
              path: ["discountMultiplier"],
              label: "Customer pays this share of the price",
              kind: "percent",
            },
          ],
        },
        {
          title: "Extras",
          fields: config.extras.map((extra, i) => ({
            path: ["extras", i, "price"],
            label: extra.hasQuantity
              ? `${extra.name} (per ${extra.unit ?? "unit"})`
              : extra.name,
            kind: "money" as const,
          })),
        },
        {
          title: "Size band midpoints",
          fields: config.sqftBands.map((band, i) => ({
            path: ["sqftBands", i, "value"],
            label: band.label,
            kind: "int" as const,
          })),
        },
      ];

    case "headline-only":
      return [
        {
          title: "Advertised prices",
          description:
            "This site has no calculator, so these are the only prices it shows.",
          fields: config.headlines.flatMap((headline, i) => [
            {
              path: ["headlines", i, "fromPrice"],
              label: `${headline.label} — from`,
              kind: "money" as const,
            },
            {
              path: ["headlines", i, "label"],
              label: `${headline.label} — name shown on site`,
              kind: "text" as const,
            },
          ]),
        },
      ];
  }
}
