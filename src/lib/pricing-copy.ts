import type { PricingEngine } from "convex/lib/pricingConfigs";
import { PRICING_ENGINE_LABELS } from "convex/lib/pricingConfigs";

/** One-sentence explanation of how each site calculator works. */
export const PRICING_ENGINE_BLURBS: Record<PricingEngine, string> = {
  "bedroom-band":
    "Starts from a bedroom base, then multiplies by home size and service level.",
  "service-base-mult":
    "Starts from a per-service base, then multiplies by property type, size, and frequency.",
  "room-plus-sqft":
    "Adds bedroom, bathroom, and square-footage charges on top of each service base.",
  "band-lookup-range":
    "Looks up a service base, adds bed/bath surcharges, and shows a low–high quote range.",
  "sqft-rate-min":
    "Charges a per-square-foot rate with a minimum, plus room add-ons.",
  "per-service-branch":
    "Each service has its own formula (home, office, deep, move-out, and so on).",
  "inline-wizard":
    "Shared bases for standard jobs, with separate branches for move-out and recurring maintenance.",
  "headline-only":
    "Advertised “from” prices only — this site does not run a live calculator.",
};

export function engineLabel(engine: PricingEngine): string {
  return PRICING_ENGINE_LABELS[engine];
}

export function engineBlurb(engine: PricingEngine): string {
  return PRICING_ENGINE_BLURBS[engine];
}
