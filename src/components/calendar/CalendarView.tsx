"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import type {
  BookingWithSite,
  CalendarEvent,
  Site,
} from "@/lib/types";
import {
  type CalendarViewMode,
  rangeForView,
  shiftCursor,
} from "@/lib/calendar-utils";
import { useShellPage } from "@/components/layout/ShellChromeContext";
import { useConnectionState } from "@/lib/hooks/useConnectionState";
import { CalendarToolbar } from "@/components/calendar/CalendarToolbar";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { WeekDayGrid } from "@/components/calendar/WeekDayGrid";
import { AgendaList } from "@/components/calendar/AgendaList";
import { ReminderSheet } from "@/components/calendar/ReminderSheet";
import { BookingDetailSheet } from "@/components/bookings/BookingDetailSheet";
import { Calendar as MiniCalendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

function shortSiteName(name: string) {
  return name.replace(" Cleaning", "");
}

export function CalendarView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteSlug = searchParams.get("site") ?? undefined;
  const deepBookingId = searchParams.get("bookingId");
  const deepReminderId = searchParams.get("reminderId");

  const { isAuthenticated } = useConvexAuth();
  const connectionState = useConnectionState();
  const sitesRaw = useQuery(api.sites.list, isAuthenticated ? {} : "skip");
  const sites = (sitesRaw ?? []) as Site[];
  const resolvedSiteId = siteSlug
    ? (sites.find((s) => s.slug === siteSlug)?.id as Id<"sites"> | undefined)
    : undefined;

  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<CalendarViewMode>("month");
  const range = useMemo(() => rangeForView(cursor, view), [cursor, view]);

  const eventsRaw = useQuery(
    api.calendar.listInRange,
    isAuthenticated
      ? {
          startAt: range.startAt,
          endAt: range.endAt,
          ...(resolvedSiteId ? { siteId: resolvedSiteId } : {}),
        }
      : "skip"
  );
  const events = (eventsRaw ?? []) as CalendarEvent[];

  const [selectedBooking, setSelectedBooking] =
    useState<BookingWithSite | null>(null);
  const [bookingSheetOpen, setBookingSheetOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderId, setReminderId] = useState<string | null>(null);
  const [reminderDue, setReminderDue] = useState<Date | undefined>();
  const [linkBookingId, setLinkBookingId] = useState<string | null>(null);

  const bookingFromDeep = useQuery(
    api.bookings.get,
    isAuthenticated && deepBookingId
      ? { bookingId: deepBookingId as Id<"bookings"> }
      : "skip"
  );

  useEffect(() => {
    if (bookingFromDeep) {
      setSelectedBooking(bookingFromDeep as BookingWithSite);
      setBookingSheetOpen(true);
    }
  }, [bookingFromDeep]);

  useEffect(() => {
    if (deepReminderId) {
      setReminderId(deepReminderId);
      setReminderOpen(true);
    }
  }, [deepReminderId]);

  const updateStatusMutation = useMutation(api.bookings.updateStatus);
  const updateNotesMutation = useMutation(api.bookings.updateInternalNotes);
  const deleteMutation = useMutation(api.bookings.remove);
  const archiveMutation = useMutation(api.bookings.archive);
  const unarchiveMutation = useMutation(api.bookings.unarchive);

  useShellPage({
    connectionState,
    pageTitle: "Calendar",
    sidebar: (
      <CalendarSidebar
        sites={sites}
        siteSlug={siteSlug}
        cursor={cursor}
        onCursorChange={setCursor}
      />
    ),
    contentWidth: "full",
  });

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "t" || e.key === "T") {
        setCursor(new Date());
      } else if (e.key === "ArrowLeft") {
        setCursor((c) => shiftCursor(c, view, -1));
      } else if (e.key === "ArrowRight") {
        setCursor((c) => shiftCursor(c, view, 1));
      } else if (e.key === "m" || e.key === "M") {
        setView("month");
      } else if (e.key === "w" || e.key === "W") {
        setView("week");
      } else if (e.key === "d" || e.key === "D") {
        setView("day");
      } else if (e.key === "a" || e.key === "A") {
        setView("agenda");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  const openBooking = useCallback(
    async (bookingId: string) => {
      // Prefer live query via get — set from event metadata first
      const ev = events.find((e) => e.booking_id === bookingId);
      if (ev?.booking_id) {
        router.replace(`/calendar?bookingId=${bookingId}${siteSlug ? `&site=${siteSlug}` : ""}`, {
          scroll: false,
        });
      }
    },
    [events, router, siteSlug]
  );

  const handleSelectEvent = (event: CalendarEvent) => {
    if (event.kind === "reminder" && event.reminder_id) {
      setReminderId(event.reminder_id);
      setLinkBookingId(event.booking_id);
      setReminderOpen(true);
      return;
    }
    if (event.booking_id) {
      openBooking(event.booking_id);
    }
  };

  const handleSelectDay = (day: Date) => {
    setCursor(day);
    if (view === "month") setView("day");
  };

  return (
    <div className="-mx-4 flex h-[calc(100dvh-7.5rem)] flex-col overflow-hidden rounded-xl border bg-card shadow-sm sm:-mx-0 md:h-[calc(100dvh-5.5rem)]">
      <CalendarToolbar
        title={range.title}
        view={view}
        onViewChange={setView}
        onToday={() => setCursor(new Date())}
        onPrev={() => setCursor((c) => shiftCursor(c, view, -1))}
        onNext={() => setCursor((c) => shiftCursor(c, view, 1))}
        onAddReminder={() => {
          setReminderId(null);
          setReminderDue(cursor);
          setLinkBookingId(null);
          setReminderOpen(true);
        }}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        {eventsRaw === undefined ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading calendar…
          </div>
        ) : view === "month" ? (
          <MonthGrid
            cursor={cursor}
            events={events}
            onSelectDay={handleSelectDay}
            onSelectEvent={handleSelectEvent}
          />
        ) : view === "agenda" ? (
          <AgendaList events={events} onSelectEvent={handleSelectEvent} />
        ) : (
          <WeekDayGrid
            cursor={cursor}
            events={events}
            mode={view}
            onSelectEvent={handleSelectEvent}
          />
        )}
      </div>

      <BookingDetailSheet
        booking={selectedBooking}
        open={bookingSheetOpen}
        onOpenChange={(open) => {
          setBookingSheetOpen(open);
          if (!open) {
            setSelectedBooking(null);
            const params = new URLSearchParams(searchParams.toString());
            params.delete("bookingId");
            const q = params.toString();
            router.replace(q ? `/calendar?${q}` : "/calendar", {
              scroll: false,
            });
          }
        }}
        onStatusChange={async (id, status) => {
          await updateStatusMutation({
            bookingId: id as Id<"bookings">,
            status,
          });
        }}
        onNotesChange={async (id, notes) => {
          await updateNotesMutation({
            bookingId: id as Id<"bookings">,
            notes,
          });
        }}
        onArchive={async (id) => {
          await archiveMutation({ bookingId: id as Id<"bookings"> });
        }}
        onUnarchive={async (id) => {
          await unarchiveMutation({ bookingId: id as Id<"bookings"> });
        }}
        onDelete={async (id) => {
          await deleteMutation({ bookingId: id as Id<"bookings"> });
        }}
      />

      <ReminderSheet
        open={reminderOpen}
        onOpenChange={(open) => {
          setReminderOpen(open);
          if (!open) {
            setReminderId(null);
            const params = new URLSearchParams(searchParams.toString());
            params.delete("reminderId");
            const q = params.toString();
            router.replace(q ? `/calendar?${q}` : "/calendar", {
              scroll: false,
            });
          }
        }}
        reminderId={reminderId}
        initialDueAt={reminderDue}
        initialBookingId={linkBookingId}
        onOpenBooking={(id) => {
          setReminderOpen(false);
          openBooking(id);
        }}
      />
    </div>
  );
}

function CalendarSidebar({
  sites,
  siteSlug,
  cursor,
  onCursorChange,
}: {
  sites: Site[];
  siteSlug?: string;
  cursor: Date;
  onCursorChange: (d: Date) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-2">
        <MiniCalendar
          mode="single"
          selected={cursor}
          onSelect={(d) => d && onCursorChange(d)}
          month={cursor}
          onMonthChange={onCursorChange}
        />
      </div>

      <div className="space-y-1">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Sites
        </p>
        <Link
          href="/calendar"
          className={cn(
            "flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            !siteSlug
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-muted/60"
          )}
        >
          All sites
        </Link>
        {sites.map((site) => (
          <Link
            key={site.id}
            href={`/calendar?site=${site.slug}`}
            className={cn(
              "flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              siteSlug === site.slug
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-muted/60"
            )}
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: site.accent_color }}
            />
            <span className="truncate">{shortSiteName(site.name)}</span>
          </Link>
        ))}
      </div>

      <div className="space-y-2 rounded-xl border bg-card px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Legend
        </p>
        <div className="flex items-center gap-2 text-xs">
          <span className="h-3 w-5 rounded-sm bg-primary" />
          Confirmed job
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="h-3 w-5 rounded-sm border border-dashed border-primary bg-primary/20" />
          Requested date
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="h-3 w-5 rounded-sm border border-amber-500/50 bg-amber-500/15" />
          Reminder
        </div>
        <p className="pt-1 text-[10px] text-muted-foreground">
          Shortcuts: T today · ← → · M W D A views
        </p>
        <p className="text-[10px] text-muted-foreground">
          {format(cursor, "EEEE, MMM d")}
        </p>
      </div>
    </div>
  );
}
