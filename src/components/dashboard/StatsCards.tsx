"use client";

import { CalendarCheck, Sparkle, ListChecks } from "@phosphor-icons/react";
import type { BookingWithSite } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatsCardsProps {
  bookings: BookingWithSite[];
  className?: string;
}

export function StatsCards({ bookings, className }: StatsCardsProps) {
  const newCount = bookings.filter((b) => b.status === "new").length;
  const confirmedCount = bookings.filter((b) => b.status === "confirmed").length;
  const activeCount = bookings.filter(
    (b) => b.status === "new" || b.status === "confirmed" || b.status === "assigned"
  ).length;

  const stats = [
    {
      label: "Total",
      value: bookings.length,
      icon: ListChecks,
      accent: "text-primary bg-primary/10",
    },
    {
      label: "New",
      value: newCount,
      icon: Sparkle,
      accent: "text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-950",
      highlight: newCount > 0,
    },
    {
      label: "Confirmed",
      value: confirmedCount,
      icon: CalendarCheck,
      accent: "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950",
    },
    {
      label: "Active",
      value: activeCount,
      icon: ListChecks,
      accent: "text-violet-700 bg-violet-100 dark:text-violet-300 dark:bg-violet-950",
    },
  ];

  return (
    <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>
      {stats.map(({ label, value, icon: Icon, accent, highlight }) => (
        <div
          key={label}
          className={cn(
            "flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-sm transition-shadow sm:p-4",
            highlight && "border-sky-200 ring-1 ring-sky-100 dark:border-sky-800 dark:ring-sky-900"
          )}
        >
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", accent)}>
            <Icon size={20} weight="duotone" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold tabular-nums leading-none tracking-tight">{value}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
