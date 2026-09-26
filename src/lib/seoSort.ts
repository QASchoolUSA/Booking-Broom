import type { SeoTopQuery, SiteSeoRow } from "@/lib/types";

export type SeoSortKey = "impressions" | "clicks" | "ctr" | "position" | "name";
export type SeoSortDir = "desc" | "asc";

export type SeoSort = {
  key: SeoSortKey;
  dir: SeoSortDir;
};

export const DEFAULT_SEO_SITE_SORT: SeoSort = {
  key: "impressions",
  dir: "desc",
};

export const DEFAULT_SEO_KEYWORD_SORT: SeoSort = {
  key: "impressions",
  dir: "desc",
};

export const SEO_SITE_SORT_OPTIONS: {
  key: Exclude<SeoSortKey, "ctr" | "position">;
  label: string;
}[] = [
  { key: "impressions", label: "Impressions" },
  { key: "clicks", label: "Clicks" },
  { key: "name", label: "Name" },
];

export const SEO_KEYWORD_SORT_OPTIONS: {
  key: Exclude<SeoSortKey, "name">;
  label: string;
}[] = [
  { key: "impressions", label: "Impressions" },
  { key: "clicks", label: "Clicks" },
  { key: "ctr", label: "CTR" },
  { key: "position", label: "Position" },
];

function dirMul(dir: SeoSortDir): number {
  return dir === "desc" ? 1 : -1;
}

function metricValue(
  row: { impressions: number; clicks: number; ctr?: number; position?: number },
  key: SeoSortKey
): number {
  switch (key) {
    case "impressions":
      return row.impressions;
    case "clicks":
      return row.clicks;
    case "ctr":
      return row.ctr ?? 0;
    case "position":
      return row.position ?? 0;
    default:
      return 0;
  }
}

/** Toggle: same key flips dir; new key starts at desc (except position → asc = best first). */
export function nextSeoSort(current: SeoSort, key: SeoSortKey): SeoSort {
  if (current.key === key) {
    return { key, dir: current.dir === "desc" ? "asc" : "desc" };
  }
  if (key === "position") {
    return { key, dir: "asc" };
  }
  return { key, dir: "desc" };
}

export function sortSeoKeywords(
  queries: SeoTopQuery[],
  sort: SeoSort = DEFAULT_SEO_KEYWORD_SORT
): SeoTopQuery[] {
  const mul = dirMul(sort.dir);
  return [...queries].sort((a, b) => {
    if (sort.key === "name") {
      return mul * a.query.localeCompare(b.query);
    }
    const av = metricValue(a, sort.key);
    const bv = metricValue(b, sort.key);
    const primary = (bv - av) * mul;
    if (primary !== 0) return primary;
    // Stable secondary: impressions, then clicks, then query.
    return (
      b.impressions - a.impressions ||
      b.clicks - a.clicks ||
      a.query.localeCompare(b.query)
    );
  });
}

export function sortSeoSiteRows(
  rows: SiteSeoRow[],
  sort: SeoSort = DEFAULT_SEO_SITE_SORT
): SiteSeoRow[] {
  const mul = dirMul(sort.dir);
  return [...rows].sort((a, b) => {
    if (sort.key === "name") {
      return mul * a.site.name.localeCompare(b.site.name);
    }
    const am = a.metrics;
    const bm = b.metrics;
    // Sites without metrics always last.
    if (!am && !bm) return a.site.name.localeCompare(b.site.name);
    if (!am) return 1;
    if (!bm) return -1;
    const av = metricValue(am, sort.key);
    const bv = metricValue(bm, sort.key);
    const primary = (bv - av) * mul;
    if (primary !== 0) return primary;
    return (
      bm.impressions - am.impressions ||
      bm.clicks - am.clicks ||
      a.site.name.localeCompare(b.site.name)
    );
  });
}
