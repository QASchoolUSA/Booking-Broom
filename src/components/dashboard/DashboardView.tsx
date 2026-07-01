"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlass, ArrowsClockwise } from "@phosphor-icons/react";
import { useBookings } from "@/lib/hooks/useBookings";
import type { BookingStatus, BookingWithSite } from "@/lib/types";
import { AppShell } from "@/components/layout/AppShell";
import { SiteFilter } from "@/components/layout/SiteFilter";
import { SiteSidebar } from "@/components/layout/SiteSidebar";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { BookingList } from "@/components/bookings/BookingList";
import { BookingDetailSheet } from "@/components/bookings/BookingDetailSheet";
import { DevSeedTool } from "@/components/bookings/DevSeedTool";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DashboardViewProps {
  siteSlug?: string;
  title?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

const STATUS_FILTERS: { value: BookingStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "confirmed", label: "Confirmed" },
  { value: "assigned", label: "Assigned" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

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
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");
  const [selected, setSelected] = useState<BookingWithSite | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(() => {
    let result = bookings;

    if (statusFilter !== "all") {
      result = result.filter((b) => b.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.customer_name.toLowerCase().includes(q) ||
          b.phone?.toLowerCase().includes(q) ||
          b.email?.toLowerCase().includes(q) ||
          b.service_type.toLowerCase().includes(q) ||
          b.address?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [bookings, search, statusFilter]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    allBookings.forEach((b) => {
      const slug = b.site?.slug;
      if (slug) map[slug] = (map[slug] ?? 0) + 1;
    });
    return map;
  }, [allBookings]);

  const newCount = bookings.filter((b) => b.status === "new").length;

  return (
    <AppShell
      connectionState={connectionState}
      onRefresh={refresh}
      pageTitle={title}
      sidebar={<SiteSidebar sites={sites} counts={counts} totalCount={allBookings.length} />}
    >
      <div className="space-y-5 md:space-y-6">
        {/* Page header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="hidden min-w-0 md:block">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {newCount > 0
                ? `${newCount} new booking${newCount === 1 ? "" : "s"} need attention`
                : "All caught up — no new bookings"}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="hidden h-9 gap-2 sm:inline-flex"
              onClick={refresh}
            >
              <ArrowsClockwise size={16} />
              Refresh
            </Button>
            <DevSeedTool sites={sites} onCreated={refresh} />
          </div>
        </div>

        <StatsCards bookings={bookings} />

        {/* Mobile site filter */}
        <div className="md:hidden">
          <SiteFilter sites={sites} counts={counts} totalCount={allBookings.length} />
        </div>

        {/* Toolbar: search + status filters */}
        <div className="space-y-3 rounded-xl border bg-card p-3 shadow-sm sm:p-4">
          <div className="relative">
            <MagnifyingGlass
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search name, phone, email, service…"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              className="h-10 border-0 bg-muted/50 pl-10 shadow-none focus-visible:ring-1"
            />
          </div>

          <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-0.5">
            {STATUS_FILTERS.map(({ value, label }) => {
              const count =
                value === "all"
                  ? bookings.length
                  : bookings.filter((b) => b.status === value).length;

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                    statusFilter === value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {label}
                  <span
                    className={cn(
                      "rounded px-1 py-px text-[10px] font-bold tabular-nums",
                      statusFilter === value ? "text-primary-foreground/80" : "text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
          >
            <span className="font-medium">Connection error.</span>
            <span>{error}. Try refreshing.</span>
          </div>
        )}

        {connectionState === "offline" && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
          >
            <span className="font-medium">Offline</span>
            <span className="text-amber-800 dark:text-amber-300">
              — showing cached data. Reconnecting when back online.
            </span>
          </div>
        )}

        <BookingList
          bookings={filtered}
          loading={loading}
          emptyTitle={
            search || statusFilter !== "all"
              ? "No matching bookings"
              : emptyTitle
          }
          emptyDescription={
            search || statusFilter !== "all"
              ? "Try adjusting your search or filters."
              : emptyDescription
          }
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
