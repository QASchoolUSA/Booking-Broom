import { addDays, addMonths } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/** GSC Search Analytics API dates/times use Pacific Time. */
export const GSC_TIMEZONE = "America/Los_Angeles";

/** Format an instant as YYYY-MM-DD in Pacific Time. */
export function formatGscDate(d: Date): string {
  return formatInTimeZone(d, GSC_TIMEZONE, "yyyy-MM-dd");
}

/**
 * Calendar date in PT offset from today's PT calendar day.
 * offsetDays = 0 → today PT, -1 → yesterday PT, etc.
 */
export function gscCalendarDayOffset(offsetDays: number, now = new Date()): string {
  const todayYmd = formatInTimeZone(now, GSC_TIMEZONE, "yyyy-MM-dd");
  const noonPt = fromZonedTime(`${todayYmd}T12:00:00`, GSC_TIMEZONE);
  return formatInTimeZone(addDays(noonPt, offsetDays), GSC_TIMEZONE, "yyyy-MM-dd");
}

/** Parse YYYY-MM-DD as noon PT on that calendar day. */
export function parseGscDate(dateStr: string): Date {
  return fromZonedTime(`${dateStr}T12:00:00`, GSC_TIMEZONE);
}

/** Subtract N calendar months from a PT date string; returns YYYY-MM-DD in PT. */
export function gscDateMinusMonths(dateStr: string, months: number): string {
  const zoned = parseGscDate(dateStr);
  return formatInTimeZone(addMonths(zoned, -months), GSC_TIMEZONE, "yyyy-MM-dd");
}

/** Format a GSC HOUR dimension key (ISO timestamp) as YYYY-MM-DD in PT. */
export function formatGscDateFromHourKey(hourKey: string): string {
  const ms = Date.parse(hourKey);
  if (Number.isNaN(ms)) return hourKey.slice(0, 10);
  return formatGscDate(new Date(ms));
}
