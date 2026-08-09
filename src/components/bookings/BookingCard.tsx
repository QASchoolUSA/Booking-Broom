"use client";

import { format, formatDistanceToNow, parseISO } from "date-fns";
import { CalendarBlank, House, MapPin, Phone, User } from "@phosphor-icons/react";
import type { BookingQuote, BookingWithSite } from "@/lib/types";
import { SiteBadge } from "@/components/bookings/SiteBadge";
import { StatusBadge } from "@/components/bookings/StatusBadge";
import { formatMoney, resolveBookingDetails } from "@/lib/booking-details";
import { cn } from "@/lib/utils";

interface BookingCardProps {
  booking: BookingWithSite;
  onSelect: (booking: BookingWithSite) => void;
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

export function BookingCard({ booking, onSelect, className }: BookingCardProps) {
  const isNew = booking.status === "new";
  const { quote, property, intent } = resolveBookingDetails(booking);
  const estimate = formatEstimate(quote);
  const propertySummary = [
    property?.bedrooms !== null && property?.bedrooms !== undefined
      ? `${property.bedrooms === 0 ? "Studio" : `${property.bedrooms} bd`}`
      : null,
    property?.bathrooms !== null && property?.bathrooms !== undefined
      ? `${property.bathrooms} ba`
      : null,
    // Most sites only know a band, so fall back to its label.
    property?.square_feet
      ? `${property.square_feet.toLocaleString("en-US")} sq ft`
      : (property?.size_label ?? null),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={cn(
        "group relative flex cursor-pointer flex-col rounded-xl border bg-card p-4 shadow-sm transition-all duration-150",
        "hover:border-primary/20 hover:shadow-md active:scale-[0.99]",
        isNew && "border-primary/40 bg-primary/5 dark:border-primary/35 dark:bg-primary/10",
        className
      )}
      onClick={() => onSelect(booking)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(booking);
        }
      }}
    >
      {isNew && (
        <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary ring-4 ring-primary/20" />
      )}

      <div className="flex items-start justify-between gap-3 pr-4">
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {booking.site && <SiteBadge site={booking.site} />}
            <StatusBadge status={booking.status} />
            {intent === "quote" && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Quote only
              </span>
            )}
          </div>

          <div>
            <h3 className="flex items-center gap-2 truncate text-[15px] font-semibold leading-snug">
              <User size={16} weight="duotone" className="shrink-0 text-muted-foreground" />
              {booking.customer_name}
            </h3>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{booking.service_type}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <time
            className="text-[11px] font-medium tabular-nums text-muted-foreground"
            dateTime={booking.created_at}
          >
            {formatDistanceToNow(parseISO(booking.created_at), { addSuffix: true })}
          </time>
          {estimate && (
            <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
              {estimate}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-[13px] text-muted-foreground">
        {booking.preferred_date && (
          <p className="flex items-center gap-2 truncate">
            <CalendarBlank size={15} className="shrink-0 opacity-70" />
            {format(parseISO(booking.preferred_date), "MMM d, yyyy")}
            {booking.preferred_time && (
              <span className="text-muted-foreground/70">· {booking.preferred_time}</span>
            )}
          </p>
        )}
        {booking.address && (
          <p className="flex items-start gap-2 line-clamp-1">
            <MapPin size={15} className="mt-0.5 shrink-0 opacity-70" />
            <span className="truncate">{booking.address}</span>
          </p>
        )}
        {booking.phone && (
          <p className="flex items-center gap-2 truncate">
            <Phone size={15} className="shrink-0 opacity-70" />
            {booking.phone}
          </p>
        )}
        {propertySummary && (
          <p className="flex items-center gap-2 truncate">
            <House size={15} className="shrink-0 opacity-70" />
            {propertySummary}
          </p>
        )}
      </div>
    </article>
  );
}
