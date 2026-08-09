"use client";

import {
  ArrowsClockwise,
  Bathtub,
  Bed,
  CreditCard,
  Ruler,
  Sparkle,
} from "@phosphor-icons/react";
import type { BookingProperty, BookingQuote } from "@/lib/types";
import {
  formatBedrooms,
  formatMoney,
  hasPropertyContent,
  hasQuoteContent,
} from "@/lib/booking-details";

const sectionHeading =
  "mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground";

function StatTile({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border bg-card px-2 py-3 text-center">
      <Icon size={18} weight="duotone" className="text-muted-foreground" />
      <span className="text-base font-semibold leading-none tabular-nums">{value}</span>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon size={16} weight="duotone" />
        {label}
      </span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function BookingQuoteSection({ quote }: { quote: BookingQuote | null }) {
  if (!hasQuoteContent(quote)) return null;

  const currency = quote.currency || "USD";
  const hasRange = quote.estimate_low !== null && quote.estimate_high !== null;
  const headline =
    quote.estimate !== null
      ? formatMoney(quote.estimate, currency)
      : hasRange
        ? `${formatMoney(quote.estimate_low!, currency)}–${formatMoney(quote.estimate_high!, currency)}`
        : null;

  return (
    <section>
      <h4 className={sectionHeading}>Estimate</h4>
      <div className="overflow-hidden rounded-xl border bg-card">
        {headline && (
          <div className="flex items-baseline justify-between gap-3 border-b bg-muted/30 px-4 py-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Estimated total
              </p>
              {quote.estimate !== null && hasRange && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Range {formatMoney(quote.estimate_low!, currency)} –{" "}
                  {formatMoney(quote.estimate_high!, currency)}
                </p>
              )}
            </div>
            <p className="text-2xl font-semibold tabular-nums">{headline}</p>
          </div>
        )}

        <div className="divide-y divide-border">
          {quote.service_level && (
            <MetaRow icon={Sparkle} label="Service level" value={quote.service_level} />
          )}
          {quote.frequency && (
            <MetaRow icon={ArrowsClockwise} label="Frequency" value={quote.frequency} />
          )}

          {quote.add_ons && quote.add_ons.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Add-ons
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {quote.add_ons.map((addOn, index) => (
                  <li
                    key={`${addOn.label}-${index}`}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs font-medium"
                  >
                    {addOn.label}
                    {addOn.price !== null && (
                      <span className="tabular-nums text-muted-foreground">
                        +{formatMoney(addOn.price, currency)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {quote.payment_terms && (
          <p className="flex items-center gap-2 border-t bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
            <CreditCard size={15} weight="duotone" className="shrink-0" />
            {quote.payment_terms}
          </p>
        )}
      </div>
    </section>
  );
}

export function BookingPropertySection({
  property,
}: {
  property: BookingProperty | null;
}) {
  if (!hasPropertyContent(property)) return null;

  const tiles = [
    property.bedrooms !== null && {
      icon: Bed,
      value: formatBedrooms(property.bedrooms),
      label: property.bedrooms === 1 ? "Bedroom" : "Bedrooms",
    },
    property.bathrooms !== null && {
      icon: Bathtub,
      value: String(property.bathrooms),
      label: property.bathrooms === 1 ? "Bathroom" : "Bathrooms",
    },
    property.square_feet !== null && {
      icon: Ruler,
      value: property.square_feet.toLocaleString("en-US"),
      label: "Sq ft",
    },
  ].filter(Boolean) as { icon: React.ElementType; value: string; label: string }[];

  const caption = [property.home_type, !tiles.length ? property.size_label : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <section>
      <h4 className={sectionHeading}>Property</h4>
      {tiles.length > 0 && (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}
        >
          {tiles.map((tile) => (
            <StatTile key={tile.label} {...tile} />
          ))}
        </div>
      )}
      {caption && (
        <p className="mt-2 text-xs text-muted-foreground">{caption}</p>
      )}
      {tiles.length > 0 && property.square_feet === null && property.size_label && (
        <p className="mt-2 text-xs text-muted-foreground">
          {formatSizeLabel(property.size_label)}
        </p>
      )}
    </section>
  );
}

function formatSizeLabel(label: string) {
  return /sq/i.test(label) ? label : `Size: ${label}`;
}
