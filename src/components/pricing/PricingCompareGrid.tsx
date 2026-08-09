"use client";

import { CANONICAL_SERVICES } from "convex/lib/pricingConfigs";
import type { CanonicalService } from "convex/lib/pricingConfigs";
import { REFERENCE_BASKET_LABEL } from "convex/lib/pricingEngines";
import { Warning } from "@phosphor-icons/react";
import { formatMoney } from "@/lib/booking-details";
import type { SitePricingRow } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PricingCompareGridProps {
  rows: SitePricingRow[];
}

/**
 * Every site's price for the same property, so the columns are comparable.
 * Cheapest and dearest in each row are marked; a marketed service with no price
 * path shows as a gap rather than a blank.
 */
export function PricingCompareGrid({ rows }: PricingCompareGridProps) {
  const priced = rows.filter((row) => row.basket !== null);

  const services = CANONICAL_SERVICES.filter((service) =>
    priced.some(
      (row) =>
        row.basket?.entries[service.key] !== undefined ||
        row.basket?.gaps.includes(service.key)
    )
  );

  if (priced.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No site has pricing configured yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-10 min-w-[168px] bg-muted/40 px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                Service
              </th>
              {priced.map((row) => (
                <th
                  key={row.site.id}
                  className="min-w-[104px] px-3 py-2.5 text-right text-xs font-semibold"
                >
                  <span className="flex items-center justify-end gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: row.site.accent_color }}
                    />
                    <span className="truncate">{row.site.name}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <ServiceRow
                key={service.key}
                serviceKey={service.key}
                label={service.label}
                rows={priced}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span>Priced against {REFERENCE_BASKET_LABEL}.</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-emerald-500" />
          cheapest
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-amber-500" />
          dearest
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Warning size={12} className="text-amber-600" />
          marketed with no price
        </span>
        <span>Recurring rows are the per-visit price on the most frequent plan.</span>
      </div>
    </div>
  );
}

function ServiceRow({
  serviceKey,
  label,
  rows,
}: {
  serviceKey: CanonicalService;
  label: string;
  rows: SitePricingRow[];
}) {
  const comparable = rows
    .map((row) => row.basket?.entries[serviceKey])
    .filter((entry) => entry !== undefined && entry.kind === "computed")
    .map((entry) => entry!.price);

  const min = comparable.length > 1 ? Math.min(...comparable) : null;
  const max = comparable.length > 1 ? Math.max(...comparable) : null;

  return (
    <tr className="border-b last:border-b-0">
      <th className="sticky left-0 z-10 bg-card px-3 py-2.5 text-left text-xs font-medium">
        {label}
      </th>
      {rows.map((row) => {
        const entry = row.basket?.entries[serviceKey];
        const isGap = row.basket?.gaps.includes(serviceKey) ?? false;

        if (!entry) {
          return (
            <td
              key={row.site.id}
              className="px-3 py-2.5 text-right text-xs text-muted-foreground"
            >
              {isGap ? (
                <span
                  className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"
                  title="This site markets the service but its calculator cannot quote it"
                >
                  <Warning size={12} />
                  no price
                </span>
              ) : (
                <span className="text-muted-foreground/50">—</span>
              )}
            </td>
          );
        }

        const isMin = min !== null && entry.kind === "computed" && entry.price === min;
        const isMax = max !== null && entry.kind === "computed" && entry.price === max;

        return (
          <td key={row.site.id} className="px-3 py-2.5 text-right">
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                isMin && "text-emerald-700 dark:text-emerald-400",
                isMax && !isMin && "text-amber-700 dark:text-amber-400"
              )}
              title={entry.note ?? undefined}
            >
              {entry.kind === "from" && (
                <span className="mr-0.5 text-[10px] font-normal text-muted-foreground">
                  from
                </span>
              )}
              {formatMoney(entry.price)}
            </span>
            {entry.note && (
              <span className="block text-[10px] leading-tight text-muted-foreground">
                {entry.note}
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}
