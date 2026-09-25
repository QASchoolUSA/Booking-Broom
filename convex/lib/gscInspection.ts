/**
 * Helpers for GSC URL Inspection batching (pure — safe to unit-test).
 */

/**
 * Celebration city×service pages are intentionally noindex and must not be
 * treated as indexing failures. City hubs (`/cleaning-services/{city}`) stay.
 */
export function isIntentionalNoindexUrl(
  url: string,
  siteSlug?: string
): boolean {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "") || "/";
    if (siteSlug === "celebration") {
      return /^\/cleaning-services\/[^/]+\/[^/]+$/.test(path);
    }
    return false;
  } catch {
    return false;
  }
}

/** Extract `<loc>` URLs from a sitemap or sitemap index XML body. */
export function parseSitemapLocs(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const loc = m[1]?.trim();
    if (loc) locs.push(loc);
  }
  return locs;
}
