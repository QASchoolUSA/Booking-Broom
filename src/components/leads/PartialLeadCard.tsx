"use client";

import { formatDistanceToNow, parseISO } from "date-fns";
import { Envelope, House, MapPin, Phone, User } from "@phosphor-icons/react";
import type { BookingQuote, PartialLeadWithSite } from "@/lib/types";
import { SiteBadge } from "@/components/bookings/SiteBadge";
import { formatMoney } from "@/lib/booking-details";
import { cn } from "@/lib/utils";

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

interface PartialLeadCardProps {
  lead: PartialLeadWithSite;
  onSelect: (lead: PartialLeadWithSite) => void;
}

export function PartialLeadCard({ lead, onSelect }: PartialLeadCardProps) {
  const estimate = formatEstimate(lead.quote);
  const property = lead.property;
  const propertySummary = [
    property?.bedrooms != null
      ? `${property.bedrooms === 0 ? "Studio" : `${property.bedrooms} bd`}`
      : null,
    property?.bathrooms != null ? `${property.bathrooms} ba` : null,
    property?.size_label,
  ]
    .filter(Boolean)
    .join(" · ");

  const name = lead.customer_name?.trim() || "Unknown visitor";

  return (
    <button
      type="button"
      onClick={() => onSelect(lead)}
      className={cn(
        "flex w-full flex-col gap-3 rounded-xl border border-amber-500/30 bg-card p-4 text-left shadow-sm transition-colors hover:border-amber-500/50 hover:bg-muted/30"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold">{name}</span>
            <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Abandoned
            </span>
          </div>
          {lead.site && (
            <div className="mt-1.5">
              <SiteBadge site={lead.site} />
            </div>
          )}
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {formatDistanceToNow(parseISO(lead.updated_at), { addSuffix: true })}
        </span>
      </div>

      <div className="space-y-1.5 text-xs text-muted-foreground">
        {(lead.email || lead.phone) && (
          <div className="flex flex-wrap gap-3">
            {lead.email && (
              <span className="inline-flex items-center gap-1">
                <Envelope size={12} />
                {lead.email}
              </span>
            )}
            {lead.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone size={12} />
                {lead.phone}
              </span>
            )}
          </div>
        )}
        {lead.address && (
          <div className="inline-flex items-start gap-1">
            <MapPin size={12} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">{lead.address}</span>
          </div>
        )}
        {(lead.service_type || propertySummary || estimate) && (
          <div className="inline-flex items-start gap-1">
            <House size={12} className="mt-0.5 shrink-0" />
            <span>
              {[lead.service_type, propertySummary, estimate]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        )}
        {lead.last_step && (
          <div className="inline-flex items-center gap-1">
            <User size={12} />
            Last step: {lead.last_step}
          </div>
        )}
      </div>
    </button>
  );
}
