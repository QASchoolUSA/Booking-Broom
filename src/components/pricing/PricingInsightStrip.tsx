"use client";

import { CANONICAL_SERVICE_LABELS } from "convex/lib/pricingConfigs";
import { formatMoney } from "@/lib/booking-details";
import type { ScenarioInsight } from "@/lib/pricing-scenario";

interface PricingInsightStripProps {
  insight: ScenarioInsight;
}

export function PricingInsightStrip({ insight }: PricingInsightStripProps) {
  const serviceLabel = CANONICAL_SERVICE_LABELS[insight.serviceKey];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <InsightCard
        label={`Cheapest ${serviceLabel.toLowerCase()}`}
        value={
          insight.cheapest
            ? formatMoney(insight.cheapest.price)
            : "—"
        }
        detail={
          insight.cheapest ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: insight.cheapest.accent }}
              />
              {insight.cheapest.siteName}
            </span>
          ) : (
            "No computed quote"
          )
        }
        accent="emerald"
      />
      <InsightCard
        label="Price spread"
        value={
          insight.spread !== null ? formatMoney(insight.spread) : "—"
        }
        detail={
          insight.highest
            ? `Up to ${formatMoney(insight.highest.price)}`
            : "Need 2+ markets"
        }
        accent="amber"
      />
      <InsightCard
        label="Markets priced"
        value={`${insight.pricedCount}`}
        detail={`${insight.configuredCount} site${insight.configuredCount === 1 ? "" : "s"} configured`}
        accent="slate"
      />
    </div>
  );
}

function InsightCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: React.ReactNode;
  accent: "emerald" | "amber" | "slate";
}) {
  const valueClass =
    accent === "emerald"
      ? "text-emerald-700 dark:text-emerald-400"
      : accent === "amber"
        ? "text-amber-700 dark:text-amber-400"
        : "text-foreground";

  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tracking-tight tabular-nums motion-safe:transition-colors motion-safe:duration-200 ${valueClass}`}
      >
        {value}
      </p>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}
