import { formatGscDate } from "./gscDates";

export type GscAnalyticsRow = {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscAggregatedMetrics = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  startDate: string;
  endDate: string;
};

export type GscTopQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/** Parse a GSC HOUR dimension key to unix ms (keys are ISO timestamps in PT). */
export function parseHourKeyMs(key: string): number {
  const ms = Date.parse(key);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Sort hourly rows chronologically and keep the last 24 hour buckets. */
export function selectLast24HourRows(rows: GscAnalyticsRow[]): GscAnalyticsRow[] {
  const sorted = [...rows].sort(
    (a, b) =>
      parseHourKeyMs(a.keys?.[0] ?? "") - parseHourKeyMs(b.keys?.[0] ?? "")
  );
  return sorted.slice(-24);
}

/** Collect the last 24 distinct hour keys from rows (hour at `hourKeyIndex`). */
export function last24HourKeySet(
  rows: GscAnalyticsRow[],
  hourKeyIndex: number
): Set<string> {
  const keys = [
    ...new Set(
      rows
        .map((r) => r.keys?.[hourKeyIndex] ?? "")
        .filter((k) => k.length > 0)
    ),
  ];
  keys.sort((a, b) => parseHourKeyMs(a) - parseHourKeyMs(b));
  return new Set(keys.slice(-24));
}

function sumMetrics(rows: GscAnalyticsRow[]): GscAggregatedMetrics {
  let clicks = 0;
  let impressions = 0;
  let posWeight = 0;
  const hourMs: number[] = [];

  for (const row of rows) {
    clicks += row.clicks ?? 0;
    impressions += row.impressions ?? 0;
    posWeight += (row.position ?? 0) * (row.impressions ?? 0);
    const hourKey = row.keys?.[0];
    if (hourKey) {
      const ms = parseHourKeyMs(hourKey);
      if (ms > 0) hourMs.push(ms);
    }
  }

  let startDate = "";
  let endDate = "";
  if (hourMs.length > 0) {
    startDate = formatGscDate(new Date(Math.min(...hourMs)));
    endDate = formatGscDate(new Date(Math.max(...hourMs)));
  }

  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? posWeight / impressions : 0,
    startDate,
    endDate,
  };
}

/** Aggregate HOUR-dimension rows into GSC “last 24 hours” totals. */
export function aggregateHourlyMetrics(
  rows: GscAnalyticsRow[]
): GscAggregatedMetrics {
  return sumMetrics(selectLast24HourRows(rows));
}

/** Aggregate query+HOUR rows over the same last-24-hour window; return top N by clicks. */
export function aggregateQueryHourlyRows(
  rows: GscAnalyticsRow[],
  limit = 5
): GscTopQueryRow[] {
  const allowedHours = last24HourKeySet(rows, 1);
  const filtered = rows.filter((r) => allowedHours.has(r.keys?.[1] ?? ""));

  const byQuery = new Map<
    string,
    { clicks: number; impressions: number; posWeight: number }
  >();

  for (const row of filtered) {
    const query = row.keys?.[0] ?? "";
    if (!query) continue;
    const existing = byQuery.get(query) ?? {
      clicks: 0,
      impressions: 0,
      posWeight: 0,
    };
    existing.clicks += row.clicks ?? 0;
    existing.impressions += row.impressions ?? 0;
    existing.posWeight += (row.position ?? 0) * (row.impressions ?? 0);
    byQuery.set(query, existing);
  }

  return [...byQuery.entries()]
    .map(([query, stats]) => ({
      query,
      clicks: stats.clicks,
      impressions: stats.impressions,
      ctr: stats.impressions > 0 ? stats.clicks / stats.impressions : 0,
      position:
        stats.impressions > 0 ? stats.posWeight / stats.impressions : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, limit);
}
