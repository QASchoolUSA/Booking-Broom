import type { SeoTopQuery, SiteSeoRow } from "@/lib/types";

/** Keywords: impressions (views) desc, then clicks desc. */
export function sortSeoKeywords(queries: SeoTopQuery[]): SeoTopQuery[] {
  return [...queries].sort(
    (a, b) =>
      b.impressions - a.impressions ||
      b.clicks - a.clicks ||
      a.query.localeCompare(b.query)
  );
}

/** Sites: impressions desc, then clicks desc; no metrics last. */
export function sortSeoSiteRows(rows: SiteSeoRow[]): SiteSeoRow[] {
  return [...rows].sort((a, b) => {
    const ai = a.metrics?.impressions ?? -1;
    const bi = b.metrics?.impressions ?? -1;
    const ac = a.metrics?.clicks ?? -1;
    const bc = b.metrics?.clicks ?? -1;
    return bi - ai || bc - ac || a.site.name.localeCompare(b.site.name);
  });
}
