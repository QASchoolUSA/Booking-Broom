/** Normalize a domain or GSC property URL to a bare hostname for matching. */
export function normalizeHost(input: string): string {
  let s = input.trim().toLowerCase();
  if (s.startsWith("sc-domain:")) {
    return s.slice("sc-domain:".length).replace(/\/$/, "");
  }
  try {
    if (!s.includes("://")) s = `https://${s}`;
    const u = new URL(s);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return s.replace(/^www\./, "").replace(/\/$/, "");
  }
}

export function formatDateUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * GSC Performance presets: 24 hours, 7 days, 28 days, 3 months.
 * `90` is the stored key for the 3-month window.
 * `2` is a legacy "yesterday" key kept in DB validators until leftover rows are wiped.
 */
export type GscPeriodDays = 1 | 7 | 28 | 90;
export type GscPeriodDaysStored = 1 | 2 | 7 | 28 | 90;

export const SEO_SYNC_PERIODS = [1, 7, 28, 90] as const;

/**
 * Match an app site domain to a GSC or Bing Webmaster property URL.
 * Prefer an explicit override when provided and it exists in the property list
 * (or always if the list is empty). GSC matching is domain-only (no override).
 */
export function matchGscProperty(
  domain: string,
  properties: string[],
  override?: string | null
): string | null {
  if (override?.trim()) {
    const trimmed = override.trim();
    if (properties.length === 0) return trimmed;
    const exact = properties.find((p) => p === trimmed);
    if (exact) return exact;
    const byHost = properties.find(
      (p) => normalizeHost(p) === normalizeHost(trimmed)
    );
    if (byHost) return byHost;
    return trimmed;
  }

  const host = normalizeHost(domain);
  for (const prop of properties) {
    if (normalizeHost(prop) === host) return prop;
  }
  return null;
}

/** Alias — same hostname matching rules work for Bing site URLs. */
export const matchBingProperty = matchGscProperty;

/**
 * Daily GSC windows end yesterday so they match the Performance UI
 * (`dataState: "all"` includes fresh rows through yesterday).
 */
export const GSC_DATA_LAG_DAYS = 1;

/** Bing traffic data is typically ~1 day behind wall-clock. */
export const BING_DATA_LAG_DAYS = 1;

function utcDay(offsetDays: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}

function rollingRange(
  periodDays: GscPeriodDaysStored,
  lagDays: number
): { startDate: string; endDate: string } {
  const end = utcDay(-lagDays);

  if (periodDays === 1) {
    const d = formatDateUTC(end);
    return { startDate: d, endDate: d };
  }

  if (periodDays === 2) {
    const previous = utcDay(-lagDays - 1);
    const d = formatDateUTC(previous);
    return { startDate: d, endDate: d };
  }

  if (periodDays === 90) {
    const start = new Date(end);
    start.setUTCMonth(start.getUTCMonth() - 3);
    return {
      startDate: formatDateUTC(start),
      endDate: formatDateUTC(end),
    };
  }

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (periodDays - 1));
  return {
    startDate: formatDateUTC(start),
    endDate: formatDateUTC(end),
  };
}

/**
 * GSC date ranges. 24 hours uses today+yesterday so the hourly API
 * can return the last available 24 hour buckets.
 */
export function dateRangeForPeriod(periodDays: GscPeriodDaysStored): {
  startDate: string;
  endDate: string;
} {
  if (periodDays === 1) {
    return {
      startDate: formatDateUTC(utcDay(-1)),
      endDate: formatDateUTC(utcDay(0)),
    };
  }
  return rollingRange(periodDays, GSC_DATA_LAG_DAYS);
}

export function dateRangeForBingPeriod(periodDays: GscPeriodDaysStored): {
  startDate: string;
  endDate: string;
} {
  return rollingRange(periodDays, BING_DATA_LAG_DAYS);
}

/** Parse Bing `/Date(ms)` or `/Date(ms±offset)/` into YYYY-MM-DD (UTC). */
export function parseBingDate(value: string | number): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return formatDateUTC(new Date(value));
  }
  if (typeof value !== "string") return null;
  const match = /\/Date\((-?\d+)/.exec(value);
  if (!match) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return formatDateUTC(d);
  }
  const ms = Number(match[1]);
  if (!Number.isFinite(ms)) return null;
  return formatDateUTC(new Date(ms));
}
