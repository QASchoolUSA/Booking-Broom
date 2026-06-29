"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useBookings } from "@/lib/hooks/useBookings";
import type { BookingWithSite } from "@/lib/types";
import { AppShell } from "@/components/layout/AppShell";
import { SiteFilter } from "@/components/layout/SiteFilter";
import { SiteSidebar } from "@/components/layout/SiteSidebar";
import { BookingList } from "@/components/bookings/BookingList";
import { BookingDetailSheet } from "@/components/bookings/BookingDetailSheet";
import { DevSeedTool } from "@/components/bookings/DevSeedTool";
import { Input } from "@/components/ui/input";

interface DashboardViewProps {
  siteSlug?: string;
  title?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DashboardView({
  siteSlug,
  title = "All Bookings",
  emptyTitle,
  emptyDescription,
}: DashboardViewProps) {
  const {
    bookings,
    allBookings,
    sites,
    loading,
    connectionState,
    error,
    refresh,
    updateBookingStatus,
    updateInternalNotes,
  } = useBookings(siteSlug);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<BookingWithSite | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return bookings;
    const q = search.toLowerCase();
    return bookings.filter(
      (b) =>
        b.customer_name.toLowerCase().includes(q) ||
        b.phone?.toLowerCase().includes(q) ||
        b.email?.toLowerCase().includes(q) ||
        b.service_type.toLowerCase().includes(q)
    );
  }, [bookings, search]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    allBookings.forEach((b) => {
      const slug = b.site?.slug;
      if (slug) map[slug] = (map[slug] ?? 0) + 1;
    });
    return map;
  }, [allBookings]);

  const newCount = allBookings.filter((b) => b.status === "new").length;

  return (
    <AppShell
      connectionState={connectionState}
      onRefresh={refresh}
      sidebar={<SiteSidebar sites={sites} counts={counts} totalCount={allBookings.length} />}
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground">
              {newCount > 0
                ? `${newCount} new booking${newCount === 1 ? "" : "s"} need attention`
                : "All caught up"}
            </p>
          </div>
          <DevSeedTool sites={sites} onCreated={refresh} />
        </div>

        <div className="md:hidden">
          <SiteFilter
            sites={sites}
            counts={counts}
            totalCount={allBookings.length}
          />
        </div>

        <div className="relative">
          <MagnifyingGlass
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search by name, phone, or service…"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            className="min-h-11 pl-10"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}. Check your Supabase connection and try refreshing.
          </div>
        )}

        {connectionState === "offline" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            You&apos;re offline. Showing cached data. Reconnecting when back online.
          </div>
        )}

        <BookingList
          bookings={filtered}
          loading={loading}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          onSelect={(booking) => {
            setSelected(booking);
            setSheetOpen(true);
          }}
        />
      </div>

      <BookingDetailSheet
        booking={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onStatusChange={updateBookingStatus}
        onNotesChange={updateInternalNotes}
      />
    </AppShell>
  );
}
