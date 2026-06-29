"use client";

import { format, formatDistanceToNow, parseISO } from "date-fns";
import { CalendarBlank, Clock, MapPin, User } from "@phosphor-icons/react";
import type { BookingWithSite } from "@/lib/types";
import { SiteBadge } from "@/components/bookings/SiteBadge";
import { StatusBadge } from "@/components/bookings/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BookingCardProps {
  booking: BookingWithSite;
  onSelect: (booking: BookingWithSite) => void;
  className?: string;
}

export function BookingCard({ booking, onSelect, className }: BookingCardProps) {
  const isNew = booking.status === "new";

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.99]",
        isNew && "border-sky-300 ring-1 ring-sky-200 dark:border-sky-700 dark:ring-sky-900",
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
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {booking.site && <SiteBadge site={booking.site} />}
              <StatusBadge status={booking.status} />
            </div>
            <h3 className="flex items-center gap-2 truncate text-base font-semibold">
              <User size={18} weight="duotone" className="shrink-0 text-muted-foreground" />
              {booking.customer_name}
            </h3>
            <p className="text-sm text-muted-foreground">{booking.service_type}</p>
          </div>
          <time
            className="shrink-0 text-xs text-muted-foreground"
            dateTime={booking.created_at}
          >
            {formatDistanceToNow(parseISO(booking.created_at), { addSuffix: true })}
          </time>
        </div>

        <div className="mt-3 grid gap-1.5 text-sm text-muted-foreground">
          {booking.preferred_date && (
            <p className="flex items-center gap-2">
              <CalendarBlank size={16} className="shrink-0" />
              {format(parseISO(booking.preferred_date), "MMM d, yyyy")}
              {booking.preferred_time && ` · ${booking.preferred_time}`}
            </p>
          )}
          {booking.address && (
            <p className="flex items-start gap-2 line-clamp-2">
              <MapPin size={16} className="mt-0.5 shrink-0" />
              {booking.address}
            </p>
          )}
          {booking.phone && (
            <p className="flex items-center gap-2">
              <Clock size={16} className="shrink-0" />
              {booking.phone}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
