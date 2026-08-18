import {
  addDays,
  addMonths,
  addWeeks,
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
import { toZonedTime } from "date-fns-tz";
import type { CalendarEvent } from "@/lib/types";

export type CalendarViewMode = "month" | "week" | "day" | "agenda";

export const DEFAULT_TZ = "America/New_York";

export function rangeForView(
  cursor: Date,
  view: CalendarViewMode
): { startAt: number; endAt: number; title: string } {
  if (view === "month") {
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
  if (view === "week") {
    const weekStart = startOfWeek(cursor, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(cursor, { weekStartsOn: 0 });
    return {
      startAt: weekStart.getTime(),
      endAt: endOfDay(weekEnd).getTime(),
      title: `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`,
    };
  }
  if (view === "day") {
    return {
      startAt: startOfDay(cursor).getTime(),
      endAt: endOfDay(cursor).getTime(),
      title: format(cursor, "EEEE, MMM d, yyyy"),
    };
  }
  // agenda: show from cursor through +30 days
  const start = startOfDay(cursor);
  const end = endOfDay(addDays(cursor, 30));
  return {
    startAt: start.getTime(),
    endAt: end.getTime(),
    title: `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`,
  };
}

export function shiftCursor(
  cursor: Date,
  view: CalendarViewMode,
  direction: -1 | 1
): Date {
  if (view === "month") return addMonths(cursor, direction);
  if (view === "week") return addWeeks(cursor, direction);
  if (view === "day") return addDays(cursor, direction);
  return addDays(cursor, direction * 7);
}

export function monthCells(cursor: Date): Date[] {
  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(addDays(gridStart, i));
  }
  return cells;
}

export function weekDays(cursor: Date): Date[] {
  const weekStart = startOfWeek(cursor, { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function eventsForDay(
  events: CalendarEvent[],
  day: Date
): CalendarEvent[] {
  const start = startOfDay(day).getTime();
  const end = endOfDay(day).getTime();
  return events.filter((e) => e.start_at_ms <= end && e.end_at_ms >= start);
}

export function formatEventTime(
  event: CalendarEvent,
  timeZone: string = DEFAULT_TZ
): string {
  if (event.all_day) return "All day";
  const start = toZonedTime(event.start_at_ms, timeZone);
  const end = toZonedTime(event.end_at_ms, timeZone);
  if (event.kind === "reminder") {
    return format(start, "h:mm a");
  }
  return `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`;
}

export function isToday(day: Date): boolean {
  return isSameDay(day, new Date());
}

export function inCurrentMonth(day: Date, cursor: Date): boolean {
  return isSameMonth(day, cursor);
}

/** Hex → rgba with alpha for tentative fills. */
export function withAlpha(hex: string, alpha: number): string {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return hex;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const HOUR_HEIGHT = 56;
export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 21;
