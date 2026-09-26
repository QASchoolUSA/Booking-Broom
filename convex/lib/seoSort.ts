/**
 * Rank keywords for storage / default API order: clicks first so truncated
 * lists retain the traffic that reconciles with site-level click totals.
 */
export function compareSeoQueries(
  a: { impressions: number; clicks: number; query?: string },
  b: { impressions: number; clicks: number; query?: string }
): number {
  return (
    b.clicks - a.clicks ||
    b.impressions - a.impressions ||
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
 * Sync paginates GSC until exhausted, then keeps this many (clicks-first).
 * Remaining gap vs site totals is usually GSC/Bing privacy anonymization of
 * rare queries (counted in property totals, omitted from the query dimension).
 */
export const SEO_TOP_QUERY_LIMIT = 500;

/** GSC Search Analytics max rows per request (API hard cap). */
export const GSC_API_PAGE_SIZE = 25_000;

/** Safety ceiling when paginating query / query×HOUR rows. */
export const GSC_QUERY_FETCH_CAP = 100_000;

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
