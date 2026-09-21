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
