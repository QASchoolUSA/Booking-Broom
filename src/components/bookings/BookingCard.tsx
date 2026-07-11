"use client";

import { format, formatDistanceToNow, parseISO } from "date-fns";
import { CalendarBlank, MapPin, Phone, User } from "@phosphor-icons/react";
import type { BookingWithSite } from "@/lib/types";
import { SiteBadge } from "@/components/bookings/SiteBadge";
import { StatusBadge } from "@/components/bookings/StatusBadge";
import { cn } from "@/lib/utils";

interface BookingCardProps {
  booking: BookingWithSite;
  onSelect: (booking: BookingWithSite) => void;
  className?: string;
}

export function BookingCard({ booking, onSelect, className }: BookingCardProps) {
  const isNew = booking.status === "new";

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
          </div>

          <div>
            <h3 className="flex items-center gap-2 truncate text-[15px] font-semibold leading-snug">
              <User size={16} weight="duotone" className="shrink-0 text-muted-foreground" />
              {booking.customer_name}
            </h3>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{booking.service_type}</p>
          </div>
        </div>

        <time
          className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground"
          dateTime={booking.created_at}
        >
          {formatDistanceToNow(parseISO(booking.created_at), { addSuffix: true })}
        </time>
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
      </div>
    </article>
  );
}
