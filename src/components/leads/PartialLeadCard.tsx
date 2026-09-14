"use client";

import { format, formatDistanceToNow, parseISO } from "date-fns";
import { CalendarBlank, House, MapPin, Phone, User } from "@phosphor-icons/react";
import type { BookingQuote, PartialLeadWithSite } from "@/lib/types";
import { SiteBadge } from "@/components/bookings/SiteBadge";
import { formatMoney } from "@/lib/booking-details";
import { cn } from "@/lib/utils";

interface PartialLeadCardProps {
  lead: PartialLeadWithSite;
  onSelect: (lead: PartialLeadWithSite) => void;
  className?: string;
}

/** Sites quote inconsistently, so show whichever figure they did send. */
function formatEstimate(quote: BookingQuote | null): string | null {
  if (!quote) return null;

  const { currency } = quote;
  if (quote.estimate !== null) return formatMoney(quote.estimate, currency);
  if (quote.estimate_low !== null && quote.estimate_high !== null) {
    return `${formatMoney(quote.estimate_low, currency)}–${formatMoney(quote.estimate_high, currency)}`;
  }
  if (quote.estimate_low !== null) return formatMoney(quote.estimate_low, currency);
  if (quote.recurring_estimate !== null) {
    return formatMoney(quote.recurring_estimate, currency);
  }
  return null;
}

export function PartialLeadCard({ lead, onSelect, className }: PartialLeadCardProps) {
  const estimate = formatEstimate(lead.quote);
  const property = lead.property;
  const propertySummary = [
    property?.bedrooms !== null && property?.bedrooms !== undefined
      ? `${property.bedrooms === 0 ? "Studio" : `${property.bedrooms} bd`}`
      : null,
    property?.bathrooms !== null && property?.bathrooms !== undefined
      ? `${property.bathrooms} ba`
      : null,
    property?.square_feet
      ? `${property.square_feet.toLocaleString("en-US")} sq ft`
      : (property?.size_label ?? null),
  ]
    .filter(Boolean)
    .join(" · ");

  const name = lead.customer_name?.trim() || "Unknown visitor";
  const service = lead.service_type?.trim() || "Incomplete quote";

  return (
    <article
      className={cn(
        "group relative flex cursor-pointer flex-col rounded-xl border bg-card p-4 shadow-sm transition-all duration-150",
        "hover:border-primary/20 hover:shadow-md active:scale-[0.99]",
        className
      )}
      onClick={() => onSelect(lead)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(lead);
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {lead.site && <SiteBadge site={lead.site} />}
            <span className="inline-flex items-center rounded-md border border-slate-200/80 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold leading-none text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              Abandoned
            </span>
            {lead.intent === "quote" && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Quote only
              </span>
            )}
            {lead.intent === "book" && (
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Book
              </span>
            )}
          </div>

          <div>
            <h3 className="flex items-center gap-2 truncate text-[15px] font-semibold leading-snug">
              <User size={16} weight="duotone" className="shrink-0 text-muted-foreground" />
              {name}
            </h3>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{service}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <time
            className="text-[11px] font-medium tabular-nums text-muted-foreground"
            dateTime={lead.updated_at}
          >
            {formatDistanceToNow(parseISO(lead.updated_at), { addSuffix: true })}
          </time>
          {estimate && (
            <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
              {estimate}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-[13px] text-muted-foreground">
        {lead.preferred_date && (
          <p className="flex items-center gap-2 truncate">
            <CalendarBlank size={15} className="shrink-0 opacity-70" />
            {format(parseISO(lead.preferred_date), "MMM d, yyyy")}
            {lead.preferred_time && (
              <span className="text-muted-foreground/70">· {lead.preferred_time}</span>
            )}
          </p>
        )}
        {lead.address && (
          <p className="flex items-start gap-2 line-clamp-1">
            <MapPin size={15} className="mt-0.5 shrink-0 opacity-70" />
            <span className="truncate">{lead.address}</span>
          </p>
        )}
        {lead.phone && (
          <p className="flex items-center gap-2 truncate">
            <Phone size={15} className="shrink-0 opacity-70" />
            {lead.phone}
          </p>
        )}
        {propertySummary && (
          <p className="flex items-center gap-2 truncate">
            <House size={15} className="shrink-0 opacity-70" />
            {propertySummary}
          </p>
        )}
        {!lead.preferred_date && !lead.address && !lead.phone && !propertySummary && lead.last_step && (
          <p className="flex items-center gap-2 truncate">
            <User size={15} className="shrink-0 opacity-70" />
            Last step: {lead.last_step}
          </p>
        )}
      </div>
    </article>
  );
}
