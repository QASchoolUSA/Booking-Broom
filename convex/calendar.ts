import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  DEFAULT_TIMEZONE,
  preferredToWindow,
  rangesOverlap,
  formatYmdInZone,
} from "./lib/calendarTime";

type CalendarEvent = {
  id: string;
  kind: "booking_tentative" | "booking_confirmed" | "reminder";
  title: string;
  subtitle: string | null;
  start_at: string;
  end_at: string;
  start_at_ms: number;
  end_at_ms: number;
  all_day: boolean;
  booking_id: string | null;
  reminder_id: string | null;
  status: string;
  preferred_date: string | null;
  preferred_time: string | null;
  timezone: string;
  site: {
    id: Id<"sites">;
    slug: string;
    name: string;
    accent_color: string;
  } | null;
  color: string;
};

function mapSiteBrief(site: Doc<"sites">) {
  return {
    id: site._id,
    slug: site.slug,
    name: site.name,
    accent_color: site.accentColor,
  };
}

function mapBookingEvent(
  booking: Doc<"bookings">,
  site: Doc<"sites"> | undefined,
  kind: "booking_tentative" | "booking_confirmed",
  startAt: number,
  endAt: number,
  allDay: boolean
): CalendarEvent {
  return {
    id:
      kind === "booking_confirmed"
        ? `confirmed-${booking._id}`
        : `tentative-${booking._id}`,
    kind,
    title: booking.customerName,
    subtitle: booking.serviceType,
    start_at: new Date(startAt).toISOString(),
    end_at: new Date(endAt).toISOString(),
    start_at_ms: startAt,
    end_at_ms: endAt,
    all_day: allDay,
    booking_id: booking._id,
    reminder_id: null,
    status: booking.status,
    preferred_date: booking.preferredDate ?? null,
    preferred_time: booking.preferredTime ?? null,
    timezone: booking.timezone ?? DEFAULT_TIMEZONE,
    site: site ? mapSiteBrief(site) : null,
    color: site?.accentColor ?? "#16a34a",
  };
}

function mapReminderEvent(reminder: Doc<"reminders">): CalendarEvent {
  const endAt = reminder.allDay
    ? reminder.dueAt + 24 * 60 * 60 * 1000 - 1
    : reminder.dueAt + 30 * 60 * 1000;
  return {
    id: `reminder-${reminder._id}`,
    kind: "reminder",
    title: reminder.title,
    subtitle: reminder.notes ?? null,
    start_at: new Date(reminder.dueAt).toISOString(),
    end_at: new Date(endAt).toISOString(),
    start_at_ms: reminder.dueAt,
    end_at_ms: endAt,
    all_day: reminder.allDay ?? false,
    booking_id: reminder.bookingId ?? null,
    reminder_id: reminder._id,
    status: reminder.status,
    preferred_date: null,
    preferred_time: null,
    timezone: DEFAULT_TIMEZONE,
    site: null,
    color: "#d97706",
  };
}

/**
 * Unified calendar feed for web + mobile.
 * Confirmed jobs win over tentative preferred windows for the same booking.
 */
export const listInRange = query({
  args: {
    startAt: v.number(),
    endAt: v.number(),
    siteId: v.optional(v.id("sites")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    if (args.endAt < args.startAt) return [];

    const sites = await ctx.db.query("sites").collect();
    const siteMap = new Map<Id<"sites">, Doc<"sites">>(
      sites.map((s) => [s._id, s])
    );

    const events: CalendarEvent[] = [];
    const confirmedIds = new Set<string>();

    const scheduled = await ctx.db
      .query("bookings")
      .withIndex("by_scheduled_start", (q) =>
        q.gte("scheduledStartAt", args.startAt - 48 * 60 * 60 * 1000)
      )
      .take(500);

    for (const booking of scheduled) {
      if (booking.archivedAt != null) continue;
      if (booking.status === "cancelled") continue;
      if (args.siteId && booking.siteId !== args.siteId) continue;
      if (booking.scheduledStartAt == null || booking.scheduledEndAt == null) {
        continue;
      }
      if (
        !rangesOverlap(
          booking.scheduledStartAt,
          booking.scheduledEndAt,
          args.startAt,
          args.endAt
        )
      ) {
        continue;
      }
      confirmedIds.add(booking._id);
      events.push(
        mapBookingEvent(
          booking,
          siteMap.get(booking.siteId),
          "booking_confirmed",
          booking.scheduledStartAt,
          booking.scheduledEndAt,
          false
        )
      );
    }

    const startYmd = formatYmdInZone(args.startAt, DEFAULT_TIMEZONE);
    const endYmd = formatYmdInZone(args.endAt, DEFAULT_TIMEZONE);

    const preferred = await ctx.db
      .query("bookings")
      .withIndex("by_preferred_date", (q) =>
        q.gte("preferredDate", startYmd).lte("preferredDate", endYmd)
      )
      .take(500);

    for (const booking of preferred) {
      if (booking.archivedAt != null) continue;
      if (booking.status === "cancelled") continue;
      if (args.siteId && booking.siteId !== args.siteId) continue;
      if (confirmedIds.has(booking._id)) continue;
      if (!booking.preferredDate) continue;

      const window = preferredToWindow(
        booking.preferredDate,
        booking.preferredTime,
        booking.timezone ?? DEFAULT_TIMEZONE
      );
      if (!window) continue;
      if (
        !rangesOverlap(window.startAt, window.endAt, args.startAt, args.endAt)
      ) {
        continue;
      }
      events.push(
        mapBookingEvent(
          booking,
          siteMap.get(booking.siteId),
          "booking_tentative",
          window.startAt,
          window.endAt,
          window.allDay
        )
      );
    }

    const reminders = await ctx.db
      .query("reminders")
      .withIndex("by_due", (q) =>
        q.gte("dueAt", args.startAt - 24 * 60 * 60 * 1000)
      )
      .take(500);

    for (const reminder of reminders) {
      if (reminder.status === "cancelled") continue;
      const reminderEnd = reminder.allDay
        ? reminder.dueAt + 24 * 60 * 60 * 1000
        : reminder.dueAt;
      if (
        !rangesOverlap(reminder.dueAt, reminderEnd, args.startAt, args.endAt)
      ) {
        continue;
      }
      if (args.siteId && reminder.bookingId) {
        const booking = await ctx.db.get(reminder.bookingId);
        if (!booking || booking.siteId !== args.siteId) continue;
      }
      events.push(mapReminderEvent(reminder));
    }

    return events.sort((a, b) => a.start_at_ms - b.start_at_ms);
  },
});
