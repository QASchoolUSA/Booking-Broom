import type { PricingConfig } from "convex/lib/pricingConfigs";
import type { CanonicalService } from "convex/lib/pricingConfigs";
import {
  collectAddonCatalog,
  DEFAULT_SCENARIO,
  scenarioFromInputs,
  type PricingScenario,
} from "convex/lib/pricingEngines";
import type { SitePricingRow } from "@/lib/types";

export type ScenarioPresetId = "reference" | "compact" | "large";

export const SCENARIO_PRESETS: {
  id: ScenarioPresetId;
  label: string;
  scenario: PricingScenario;
}[] = [
  {
    id: "reference",
    label: "Reference",
    scenario: { ...DEFAULT_SCENARIO, addonKeys: [] },
  },
  {
    id: "compact",
    label: "Compact",
    scenario: scenarioFromInputs({
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 1200,
    }),
  },
  {
    id: "large",
    label: "Large",
    scenario: scenarioFromInputs({
      bedrooms: 4,
      bathrooms: 3,
      squareFeet: 2800,
    }),
  },
];

export const PROPERTY_TYPE_OPTIONS = [
  { key: "house", label: "House" },
  { key: "apartment", label: "Apartment" },
  { key: "condo", label: "Condo" },
  { key: "townhouse", label: "Townhouse" },
] as const;

export const CONDITION_OPTIONS = [
  { key: "Average", label: "Average" },
  { key: "Light", label: "Light" },
  { key: "Heavy", label: "Heavy" },
] as const;

export function buildScenario(partial: {
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  hours?: number;
  conditionKey?: string;
  propertyTypeKey?: string;
  debrisKey?: string;
  addonKeys?: string[];
}): PricingScenario {
  return scenarioFromInputs(partial);
}

export function addonCatalogFromRows(
  rows: SitePricingRow[]
): { key: string; label: string }[] {
  const configs = rows
    .map((row) => row.pricing?.config)
    .filter((config): config is PricingConfig => config != null);
  return collectAddonCatalog(configs);
}

export function matchPresetId(
  scenario: PricingScenario
): ScenarioPresetId | null {
  for (const preset of SCENARIO_PRESETS) {
    const p = preset.scenario;
    if (
      p.bedrooms === scenario.bedrooms &&
      p.bathrooms === scenario.bathrooms &&
      p.squareFeet === scenario.squareFeet &&
      p.propertyTypeKey === scenario.propertyTypeKey &&
      p.conditionKey === scenario.conditionKey &&
      scenario.addonKeys.length === 0
    ) {
      return preset.id;
    }
  }
  return null;
}

export type ScenarioInsight = {
  serviceKey: CanonicalService;
  cheapest: { siteName: string; accent: string; price: number } | null;
  highest: { siteName: string; accent: string; price: number } | null;
  spread: number | null;
  pricedCount: number;
  configuredCount: number;
};

export function computeScenarioInsight(
  rows: SitePricingRow[],
  serviceKey: CanonicalService = "standard"
): ScenarioInsight {
  const configured = rows.filter((row) => row.pricing !== null);
  const priced = configured
    .map((row) => {
      const entry = row.basket?.entries[serviceKey];
      if (!entry || entry.kind !== "computed") return null;
      return {
        siteName: row.site.name,
        accent: row.site.accent_color,
        price: entry.price,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (priced.length === 0) {
    return {
      serviceKey,
      cheapest: null,
      highest: null,
      spread: null,
      pricedCount: 0,
      configuredCount: configured.length,
    };
  }

  const cheapest = priced.reduce((best, row) =>
    row.price < best.price ? row : best
  );
  const highest = priced.reduce((best, row) =>
    row.price > best.price ? row : best
  );

  return {
    serviceKey,
    cheapest,
    highest: priced.length > 1 ? highest : null,
    spread: priced.length > 1 ? highest.price - cheapest.price : null,
    pricedCount: priced.length,
    configuredCount: configured.length,
  };
}
