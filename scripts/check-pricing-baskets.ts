/**
 * Prints the reference-basket price every site's seeded config produces.
 * Run after changing an engine to confirm the numbers still match the sites:
 *   pnpm exec tsx scripts/check-pricing-baskets.ts
 */
import { SEED_PRICING } from "../convex/lib/pricingSeed";
import {
  computeReferenceBasket,
  REFERENCE_BASKET_LABEL,
} from "../convex/lib/pricingEngines";
import { CANONICAL_SERVICE_LABELS } from "../convex/lib/pricingConfigs";

console.log(`Reference property: ${REFERENCE_BASKET_LABEL}\n`);

for (const seed of SEED_PRICING) {
  const basket = computeReferenceBasket(seed.config);
  console.log(`${seed.slug}  (${seed.engine})`);
  for (const [key, entry] of Object.entries(basket.entries)) {
    const label = CANONICAL_SERVICE_LABELS[key as keyof typeof CANONICAL_SERVICE_LABELS];
    const from = entry.kind === "from" ? "from " : "";
    const note = entry.note ? `  — ${entry.note}` : "";
    console.log(`  ${label.padEnd(24)} ${from}$${entry.price}${note}`);
  }
  if (basket.gaps.length > 0) {
    console.log(`  gaps: ${basket.gaps.join(", ")}`);
  }
  console.log();
}
