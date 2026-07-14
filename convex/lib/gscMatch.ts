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

/**
 * Match an app site domain to a GSC property URL.
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

export function formatDateUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** periodDays: 1 = today, 2 = yesterday, 7/28/90 = rolling windows. */
export type GscPeriodDays = 1 | 2 | 7 | 28 | 90;

export const PERIOD_TODAY = 1 as const;
export const PERIOD_YESTERDAY = 2 as const;

/**
 * Date ranges for GSC queries.
 * Today/yesterday use UTC calendar days (may be empty due to GSC lag).
 * Rolling windows end 3 days ago UTC to account for GSC lag.
 */
export function dateRangeForPeriod(periodDays: GscPeriodDays): {
  startDate: string;
  endDate: string;
} {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (periodDays === PERIOD_TODAY) {
    const d = formatDateUTC(today);
    return { startDate: d, endDate: d };
  }
  if (periodDays === PERIOD_YESTERDAY) {
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const d = formatDateUTC(yesterday);
    return { startDate: d, endDate: d };
  }

  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (periodDays - 1));
  return {
    startDate: formatDateUTC(start),
    endDate: formatDateUTC(end),
  };
}
