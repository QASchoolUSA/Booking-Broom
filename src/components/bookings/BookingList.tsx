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
    const groups: { label: string; items: BookingWithSite[] }[] = [
      { label: "Today", items: [] },
      { label: "Earlier", items: [] },
    ];

    bookings.forEach((booking) => {
      const date = new Date(booking.created_at).toDateString();
      if (date === today) {
        groups[0].items.push(booking);
      } else {
        groups[1].items.push(booking);
      }
    });

    return groups.filter((g) => g.items.length > 0);
  }, [bookings]);

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
          <Broom size={28} weight="duotone" />
        </div>
        <h3 className="text-lg font-semibold">{emptyTitle}</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <section key={group.label}>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            {group.label}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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
