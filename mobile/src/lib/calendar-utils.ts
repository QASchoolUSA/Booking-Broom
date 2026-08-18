import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export type MobileCalendarEvent = {
  id: string;
  kind: "booking_tentative" | "booking_confirmed" | "reminder";
  title: string;
  subtitle: string | null;
  start_at_ms: number;
  end_at_ms: number;
  all_day: boolean;
  booking_id: string | null;
  reminder_id: string | null;
  color: string;
  site: { name: string; accent_color: string; slug: string } | null;
};

export function monthCells(cursor: Date): Date[] {
  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function rangeForMonth(cursor: Date) {
  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const monthEnd = endOfMonth(cursor);
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  return {
    startAt: gridStart.getTime(),
    endAt: endOfDay(gridEnd).getTime(),
    title: format(cursor, "MMMM yyyy"),
  };
}

export function eventsForDay(
  events: MobileCalendarEvent[],
  day: Date
): MobileCalendarEvent[] {
  const start = startOfDay(day).getTime();
  const end = endOfDay(day).getTime();
  return events.filter((e) => e.start_at_ms <= end && e.end_at_ms >= start);
}

export function isToday(day: Date) {
  return isSameDay(day, new Date());
}

export function inMonth(day: Date, cursor: Date) {
  return isSameMonth(day, cursor);
}

export function formatEventTime(event: MobileCalendarEvent) {
  if (event.all_day) return "All day";
  return format(new Date(event.start_at_ms), "h:mm a");
}

const DEFAULT_TZ = "America/New_York";

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = dtf.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return asUtc - date.getTime();
}

/** Interpret wall-clock local parts in `timeZone` as a UTC unix ms. */
export function wallTimeToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string = DEFAULT_TZ
): number {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  return utcGuess - offset;
}
