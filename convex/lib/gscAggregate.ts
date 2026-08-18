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

const MS_PER_HOUR = 60 * 60 * 1000;

/** Parse a GSC HOUR dimension key to unix ms (keys are ISO timestamps in PT). */
export function parseHourKeyMs(key: string): number {
  const ms = Date.parse(key);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Keep hour buckets whose start time falls in the rolling last 24 hours ending
 * at `now` — matches the GSC Performance “24 hours” preset (last available 24h).
 */
export function filterRowsInLast24Hours(
  rows: GscAnalyticsRow[],
  hourKeyIndex: number,
  now = new Date()
): GscAnalyticsRow[] {
  const endMs = now.getTime();
  const startMs = endMs - 24 * MS_PER_HOUR;
  return rows.filter((r) => {
    const ms = parseHourKeyMs(r.keys?.[hourKeyIndex] ?? "");
    return ms >= startMs && ms <= endMs;
  });
}

/** @deprecated Use filterRowsInLast24Hours — kept for tests comparing approaches. */
export function selectLast24HourRows(rows: GscAnalyticsRow[]): GscAnalyticsRow[] {
  const sorted = [...rows].sort(
    (a, b) =>
      parseHourKeyMs(a.keys?.[0] ?? "") - parseHourKeyMs(b.keys?.[0] ?? "")
  );
  return sorted.slice(-24);
}

function sumMetrics(
  rows: GscAnalyticsRow[],
  hourKeyIndex = 0
): GscAggregatedMetrics {
  let clicks = 0;
  let impressions = 0;
  let posWeight = 0;
  const hourMs: number[] = [];

  for (const row of rows) {
    clicks += row.clicks ?? 0;
    impressions += row.impressions ?? 0;
    posWeight += (row.position ?? 0) * (row.impressions ?? 0);
    const hourKey = row.keys?.[hourKeyIndex];
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
  rows: GscAnalyticsRow[],
  now = new Date()
): GscAggregatedMetrics {
  return sumMetrics(filterRowsInLast24Hours(rows, 0, now), 0);
}

/** Aggregate query+HOUR rows over the same last-24-hour window; return top N by clicks. */
export function aggregateQueryHourlyRows(
  rows: GscAnalyticsRow[],
  limit = 5,
  now = new Date()
): GscTopQueryRow[] {
  const filtered = filterRowsInLast24Hours(rows, 1, now);

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
