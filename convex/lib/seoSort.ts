/** Compare search queries: impressions (views) desc, then clicks desc. */
export function compareSeoQueries(
  a: { impressions: number; clicks: number; query?: string },
  b: { impressions: number; clicks: number; query?: string }
): number {
  return (
    b.impressions - a.impressions ||
    b.clicks - a.clicks ||
    (a.query ?? "").localeCompare(b.query ?? "")
  );
}

export function sortSeoQueries<T extends { impressions: number; clicks: number }>(
  queries: T[]
): T[] {
  return [...queries].sort(compareSeoQueries);
}

/**
 * Max keywords stored per site × period after GSC/Bing sync.
 * Site-level clicks/impressions still include all traffic; the keyword list
 * is a ranked sample. Keep this high enough that small properties reconcile,
 * without blowing past Convex document size (~1MB).
 */
export const SEO_TOP_QUERY_LIMIT = 500;

/** Compare sites: impressions desc, then clicks desc; missing metrics last. */
export function compareSeoSiteMetrics(
  a: { impressions: number; clicks: number } | null | undefined,
  b: { impressions: number; clicks: number } | null | undefined,
  nameA = "",
  nameB = ""
): number {
  const ai = a?.impressions ?? -1;
  const bi = b?.impressions ?? -1;
  const ac = a?.clicks ?? -1;
  const bc = b?.clicks ?? -1;
  return bi - ai || bc - ac || nameA.localeCompare(nameB);
}
