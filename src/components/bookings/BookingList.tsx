"use client";

import { useMemo } from "react";
import type { BookingWithSite } from "@/lib/types";
import { BookingCard } from "@/components/bookings/BookingCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Broom } from "@phosphor-icons/react";

interface BookingListProps {
  bookings: BookingWithSite[];
  loading: boolean;
  onSelect: (booking: BookingWithSite) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function BookingList({
  bookings,
  loading,
  onSelect,
  emptyTitle = "No bookings yet",
  emptyDescription = "New bookings from your cleaning sites will appear here in real time.",
}: BookingListProps) {
  const grouped = useMemo(() => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const groups: { label: string; items: BookingWithSite[] }[] = [
      { label: "Today", items: [] },
      { label: "Yesterday", items: [] },
      { label: "Earlier", items: [] },
    ];

    bookings.forEach((booking) => {
      const date = new Date(booking.created_at).toDateString();
      if (date === today) {
        groups[0].items.push(booking);
      } else if (date === yesterday) {
        groups[1].items.push(booking);
      } else {
        groups[2].items.push(booking);
      }
    });

    return groups.filter((g) => g.items.length > 0);
  }, [bookings]);

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[148px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card px-6 py-16 text-center shadow-sm">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Broom size={28} weight="duotone" />
        </div>
        <h3 className="text-base font-semibold">{emptyTitle}</h3>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <section key={group.label}>
          <div className="mb-3 flex items-center gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {group.label}
            </h3>
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs tabular-nums text-muted-foreground">{group.items.length}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onSelect={onSelect}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
