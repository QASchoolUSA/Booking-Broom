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

/** periodDays: 1 = today, 2 = yesterday, 7/28/90 = rolling windows. */
export type GscPeriodDays = 1 | 2 | 7 | 28 | 90;

export const PERIOD_TODAY = 1 as const;
export const PERIOD_YESTERDAY = 2 as const;

/**
 * Match an app site domain to a GSC or Bing Webmaster property URL.
 * Prefer an explicit override when it exists in the property list (or always if list empty).
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
 * GSC Search Analytics typically lags ~2–3 days behind wall-clock.
 * All period ranges end at UTC today minus this lag so Today/Yesterday
 * mean the latest available Search Console days (not calendar today).
 */
export const GSC_DATA_LAG_DAYS = 3;

/** Bing traffic data is typically ~1 day behind wall-clock. */
export const BING_DATA_LAG_DAYS = 1;

function dateRangeWithLag(
  periodDays: GscPeriodDays,
  lagDays: number
): { startDate: string; endDate: string } {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const latest = new Date(today);
  latest.setUTCDate(latest.getUTCDate() - lagDays);

  if (periodDays === PERIOD_TODAY) {
    const d = formatDateUTC(latest);
    return { startDate: d, endDate: d };
  }
  if (periodDays === PERIOD_YESTERDAY) {
    const previous = new Date(latest);
    previous.setUTCDate(previous.getUTCDate() - 1);
    const d = formatDateUTC(previous);
    return { startDate: d, endDate: d };
  }

  const end = latest;
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (periodDays - 1));
  return {
    startDate: formatDateUTC(start),
    endDate: formatDateUTC(end),
  };
}

/**
 * Date ranges for GSC queries.
 * Today = latest available day (todayUTC − lag).
 * Yesterday = day before that (todayUTC − lag − 1).
 * Rolling windows end at the same lag-adjusted day.
 */
export function dateRangeForPeriod(periodDays: GscPeriodDays): {
  startDate: string;
  endDate: string;
} {
  return dateRangeWithLag(periodDays, GSC_DATA_LAG_DAYS);
}

export function dateRangeForBingPeriod(periodDays: GscPeriodDays): {
  startDate: string;
  endDate: string;
} {
  return dateRangeWithLag(periodDays, BING_DATA_LAG_DAYS);
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
