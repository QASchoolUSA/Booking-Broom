"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlass, ArrowsClockwise, Broom } from "@phosphor-icons/react";
import { useBookings } from "@/lib/hooks/useBookings";
import { usePartialLeads } from "@/lib/hooks/usePartialLeads";
import type {
  BookingStatus,
  BookingWithSite,
  PartialLeadWithSite,
} from "@/lib/types";
import { resolveBookingDetails } from "@/lib/booking-details";
import { useShellPage } from "@/components/layout/ShellChromeContext";
import { SiteFilter } from "@/components/layout/SiteFilter";
import { SiteSidebar } from "@/components/layout/SiteSidebar";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { BookingList } from "@/components/bookings/BookingList";
import { BookingDetailSheet } from "@/components/bookings/BookingDetailSheet";
import { PartialLeadCard } from "@/components/leads/PartialLeadCard";
import { PartialLeadDetailSheet } from "@/components/leads/PartialLeadDetailSheet";
import { DevSeedTool } from "@/components/bookings/DevSeedTool";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

type ListMode = "active" | "archived" | "abandoned";

export function DashboardView({
  siteSlug,
  title = "All Bookings",
  emptyTitle,
  emptyDescription,
}: DashboardViewProps) {
  const [listMode, setListMode] = useState<ListMode>("active");
  const isAbandoned = listMode === "abandoned";

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
    deleteBooking,
    archiveBooking,
    unarchiveBooking,
  } = useBookings(siteSlug, { includeArchived: listMode === "archived" });

  const {
    leads,
    loading: leadsLoading,
    connectionState: leadsConnection,
    refresh: refreshLeads,
  } = usePartialLeads(siteSlug);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");
  const [selected, setSelected] = useState<BookingWithSite | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PartialLeadWithSite | null>(
    null
  );
  const [leadSheetOpen, setLeadSheetOpen] = useState(false);

  const filtered = useMemo(() => {
    let result = bookings;

    if (statusFilter !== "all") {
      result = result.filter((b) => b.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((b) => {
        const { quote } = resolveBookingDetails(b);
        return (
          b.customer_name.toLowerCase().includes(q) ||
          b.phone?.toLowerCase().includes(q) ||
          b.email?.toLowerCase().includes(q) ||
          b.service_type.toLowerCase().includes(q) ||
          b.address?.toLowerCase().includes(q) ||
          quote?.estimate?.toString().includes(q) ||
          quote?.service_level?.toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [bookings, search, statusFilter]);

  const filteredLeads = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (lead) =>
        lead.customer_name?.toLowerCase().includes(q) ||
        lead.phone?.toLowerCase().includes(q) ||
        lead.email?.toLowerCase().includes(q) ||
        lead.service_type?.toLowerCase().includes(q) ||
        lead.address?.toLowerCase().includes(q) ||
        lead.quote?.estimate?.toString().includes(q)
    );
  }, [leads, search]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    const source = isAbandoned ? leads : allBookings;
    source.forEach((row) => {
      const slug = row.site?.slug;
      if (slug) map[slug] = (map[slug] ?? 0) + 1;
    });
    return map;
  }, [allBookings, leads, isAbandoned]);

  const newCount = bookings.filter((b) => b.status === "new").length;
  const activeConnection = isAbandoned ? leadsConnection : connectionState;
  const activeRefresh = isAbandoned ? refreshLeads : refresh;
  const activeLoading = isAbandoned ? leadsLoading : loading;
  const totalCount = isAbandoned ? leads.length : allBookings.length;

  useShellPage({
    connectionState: activeConnection,
    onRefresh: activeRefresh,
    pageTitle: isAbandoned ? "Abandoned leads" : title,
    sidebar: (
      <SiteSidebar
        sites={sites}
        counts={counts}
        totalCount={totalCount}
      />
    ),
  });

  return (
    <>
      <div className="space-y-5 md:space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="hidden min-w-0 md:block">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {isAbandoned ? "Abandoned leads" : title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAbandoned
                ? leads.length > 0
                  ? `${leads.length} incomplete quote${leads.length === 1 ? "" : "s"} with contact info`
                  : "No abandoned leads yet — they appear when someone enters email or phone and leaves"
                : newCount > 0
                  ? `${newCount} new booking${newCount === 1 ? "" : "s"} need attention`
                  : "All caught up — no new bookings"}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="hidden h-9 gap-2 sm:inline-flex"
              onClick={activeRefresh}
            >
              <ArrowsClockwise size={16} />
              Refresh
            </Button>
            {!isAbandoned && (
              <DevSeedTool sites={sites} onCreated={refresh} />
            )}
          </div>
        </div>

        {!isAbandoned && <StatsCards bookings={bookings} />}

        <div className="flex flex-wrap gap-2">
          {(["active", "archived", "abandoned"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setListMode(mode)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-semibold capitalize transition-colors",
                listMode === mode
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {mode}
              {mode === "abandoned" && leads.length > 0 && (
                <span className="ml-1.5 tabular-nums opacity-80">
                  {leads.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="md:hidden">
          <SiteFilter
            sites={sites}
            counts={counts}
            totalCount={totalCount}
          />
        </div>

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

          {!isAbandoned && (
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
                        statusFilter === value
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground"
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && !isAbandoned && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
          >
            <span className="font-medium">Connection error.</span>
            <span>{error}. Try refreshing.</span>
          </div>
        )}

        {activeConnection === "offline" && (
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

        {isAbandoned ? (
          activeLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[148px] w-full rounded-xl" />
              ))}
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card px-6 py-16 text-center shadow-sm">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Broom size={28} weight="duotone" />
              </div>
              <h3 className="text-base font-semibold">
                {search ? "No matching abandoned leads" : "No abandoned leads"}
              </h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                {search
                  ? "Try adjusting your search."
                  : "When someone enters an email or phone in a quote/booking form and leaves, their snapshot shows up here."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredLeads.map((lead) => (
                <PartialLeadCard
                  key={lead.id}
                  lead={lead}
                  onSelect={(row) => {
                    setSelectedLead(row);
                    setLeadSheetOpen(true);
                  }}
                />
              ))}
            </div>
          )
        ) : (
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
        )}
      </div>

      <BookingDetailSheet
        booking={selected}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setSelected(null);
        }}
        onStatusChange={updateBookingStatus}
        onNotesChange={updateInternalNotes}
        onArchive={archiveBooking}
        onUnarchive={unarchiveBooking}
        onDelete={deleteBooking}
      />

      <PartialLeadDetailSheet
        lead={selectedLead}
        open={leadSheetOpen}
        onOpenChange={(open) => {
          setLeadSheetOpen(open);
          if (!open) setSelectedLead(null);
        }}
      />
    </>
  );
}
