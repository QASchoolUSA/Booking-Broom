/** Default ops timezone for FL / NC Eastern sites. */
export const DEFAULT_TIMEZONE = "America/New_York";

/** Default confirmed job length when the manager does not set an end time. */
export const DEFAULT_JOB_DURATION_MS = 3 * 60 * 60 * 1000;

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

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

/** Convert wall-clock local time in `timeZone` to a UTC unix ms timestamp. */
export function zonedLocalToUtcMs(
  parts: DateParts,
  timeZone: string = DEFAULT_TIMEZONE
): number {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  return utcGuess - offset;
}

/** Parse YYYY-MM-DD into calendar parts. Returns null if invalid. */
export function parseIsoDate(dateStr: string): {
  year: number;
  month: number;
  day: number;
} | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return { year, month, day };
}

export type PreferredWindow = {
  startAt: number;
  endAt: number;
  allDay: boolean;
};

/**
 * Map customer preferred date/time strings into a calendar window.
 * morning → 8–12, afternoon → 12–17, evening → 17–20;
 * clock strings → 1-hour window; otherwise all-day.
 */
export function preferredToWindow(
  preferredDate: string,
  preferredTime: string | undefined,
  timeZone: string = DEFAULT_TIMEZONE
): PreferredWindow | null {
  const date = parseIsoDate(preferredDate);
  if (!date) return null;

  const raw = (preferredTime ?? "").trim().toLowerCase();
  if (!raw) {
    const startAt = zonedLocalToUtcMs(
      { ...date, hour: 0, minute: 0, second: 0 },
      timeZone
    );
    const endAt = zonedLocalToUtcMs(
      { ...date, hour: 23, minute: 59, second: 59 },
      timeZone
    );
    return { startAt, endAt, allDay: true };
  }

  if (raw === "morning" || raw.includes("morning")) {
    return {
      startAt: zonedLocalToUtcMs(
        { ...date, hour: 8, minute: 0, second: 0 },
        timeZone
      ),
      endAt: zonedLocalToUtcMs(
        { ...date, hour: 12, minute: 0, second: 0 },
        timeZone
      ),
      allDay: false,
    };
  }
  if (raw === "afternoon" || raw.includes("afternoon")) {
    return {
      startAt: zonedLocalToUtcMs(
        { ...date, hour: 12, minute: 0, second: 0 },
        timeZone
      ),
      endAt: zonedLocalToUtcMs(
        { ...date, hour: 17, minute: 0, second: 0 },
        timeZone
      ),
      allDay: false,
    };
  }
  if (raw === "evening" || raw.includes("evening")) {
    return {
      startAt: zonedLocalToUtcMs(
        { ...date, hour: 17, minute: 0, second: 0 },
        timeZone
      ),
      endAt: zonedLocalToUtcMs(
        { ...date, hour: 20, minute: 0, second: 0 },
        timeZone
      ),
      allDay: false,
    };
  }

  const clock = parseClockTime(raw);
  if (clock) {
    const startAt = zonedLocalToUtcMs(
      { ...date, hour: clock.hour, minute: clock.minute, second: 0 },
      timeZone
    );
    return {
      startAt,
      endAt: startAt + 60 * 60 * 1000,
      allDay: false,
    };
  }

  const startAt = zonedLocalToUtcMs(
    { ...date, hour: 0, minute: 0, second: 0 },
    timeZone
  );
  const endAt = zonedLocalToUtcMs(
    { ...date, hour: 23, minute: 59, second: 59 },
    timeZone
  );
  return { startAt, endAt, allDay: true };
}

function parseClockTime(
  raw: string
): { hour: number; minute: number } | null {
  const cleaned = raw.replace(/\s+/g, "");
  const m12 = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i.exec(cleaned);
  if (m12) {
    let hour = Number(m12[1]);
    const minute = Number(m12[2] ?? "0");
    const ap = m12[3].toLowerCase();
    if (hour < 1 || hour > 12 || minute > 59) return null;
    if (ap === "pm" && hour < 12) hour += 12;
    if (ap === "am" && hour === 12) hour = 0;
    return { hour, minute };
  }
  const m24 = /^(\d{1,2}):(\d{2})$/.exec(cleaned);
  if (m24) {
    const hour = Number(m24[1]);
    const minute = Number(m24[2]);
    if (hour > 23 || minute > 59) return null;
    return { hour, minute };
  }
  return null;
}

/** Inclusive overlap check for [aStart, aEnd] vs [bStart, bEnd]. */
export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}

/** Format YYYY-MM-DD for a UTC ms instant in a timezone (calendar date). */
export function formatYmdInZone(
  ms: number,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(new Date(ms));
}
