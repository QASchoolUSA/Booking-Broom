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

/** GSC data lags ~2–3 days; end date is 3 days ago UTC. */
export function dateRangeForPeriod(periodDays: 7 | 28 | 90): {
  startDate: string;
  endDate: string;
} {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (periodDays - 1));
  return {
    startDate: formatDateUTC(start),
    endDate: formatDateUTC(end),
  };
}
