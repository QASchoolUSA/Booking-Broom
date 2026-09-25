import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  dateRangeForPeriod,
  matchGscProperty,
  normalizeHost,
  SEO_SYNC_PERIODS,
} from "./lib/gscMatch";
import {
  aggregateHourlyMetrics,
  aggregateQueryHourlyRows,
  type GscAnalyticsRow,
} from "./lib/gscAggregate";
import {
  isIntentionalNoindexUrl,
  parseSitemapLocs,
} from "./lib/gscInspection";

export { isIntentionalNoindexUrl, parseSitemapLocs } from "./lib/gscInspection";
const GSC_SCOPE =
  "https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/userinfo.email";

const PERIODS = SEO_SYNC_PERIODS;

/** Must match an authorized redirect URI on the Google OAuth client (Next.js app). */
function redirectUri(): string {
  const explicit = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) {
    throw new Error(
      "Set APP_URL or GOOGLE_REDIRECT_URI in Convex env (e.g. https://bookings.kedrik.com)"
    );
  }
  return `${appUrl.replace(/\/$/, "")}/gsc/oauth/callback`;
}

function requireGoogleCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Convex env."
    );
  }
  return { clientId, clientSecret };
}

function randomState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const getConnectUrl = action({
  args: { returnOrigin: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const { clientId } = requireGoogleCreds();
    const origin = args.returnOrigin.replace(/\/$/, "");
    if (!/^https?:\/\//i.test(origin)) {
      throw new Error("Invalid return origin");
    }

    const state = randomState();
    await ctx.runMutation(internal.gsc.createOauthState, {
      state,
      returnOrigin: origin,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri(),
      response_type: "code",
      scope: GSC_SCOPE,
      access_type: "offline",
      prompt: "consent",
      state,
    });

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    };
  },
});

async function exchangeCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const { clientId, clientSecret } = requireGoogleCreds();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "Token exchange failed"
    );
  }
  if (!data.refresh_token) {
    throw new Error(
      "No refresh token returned. Disconnect the app in Google Account permissions and try again."
    );
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 3600,
  };
}

async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as {
    email?: string;
    error?: { message?: string };
  };
  if (!res.ok || !data.email) {
    throw new Error(
      data.error?.message || "Failed to fetch Google account email"
    );
  }
  return data.email;
}

/**
 * Completes Google OAuth after the Next.js `/gsc/oauth/callback` route receives the code.
 * Auth is via one-time OAuth state (no user JWT on the callback).
 */
export const completeOAuthCallback = action({
  args: {
    code: v.string(),
    state: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    | { ok: true; returnOrigin: string }
    | { ok: false; returnOrigin: string; error: string }
  > => {
    const fallbackOrigin =
      process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

    const consumed: { returnOrigin: string } | null = await ctx.runMutation(
      internal.gsc.consumeOauthState,
      { state: args.state }
    );
    if (!consumed) {
      return {
        ok: false,
        returnOrigin: fallbackOrigin,
        error: "Invalid or expired OAuth state",
      };
    }

    try {
      const tokens = await exchangeCode(args.code);
      const email = await fetchGoogleEmail(tokens.accessToken);
      await ctx.runMutation(internal.gsc.upsertConnection, {
        googleEmail: email,
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: Date.now() + tokens.expiresIn * 1000,
      });

      await ctx.scheduler.runAfter(0, internal.gscActions.syncAllInternal, {});

      return {
        ok: true,
        returnOrigin: consumed.returnOrigin,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "OAuth failed";
      return {
        ok: false,
        returnOrigin: consumed.returnOrigin,
        error: message,
      };
    }
  },
});

async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
}> {
  const { clientId, clientSecret } = requireGoogleCreds();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "Failed to refresh Google token"
    );
  }
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in ?? 3600,
    refreshToken: data.refresh_token,
  };
}

async function listGscSites(accessToken: string): Promise<string[]> {
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as {
    siteEntry?: { siteUrl: string }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(
      data.error?.message || "Failed to list Search Console sites"
    );
  }
  return (data.siteEntry ?? []).map((s) => s.siteUrl);
}

/** Absolute sitemap URL for a cleaning-site domain. */
function sitemapFeedUrl(domain: string): string {
  return `https://${normalizeHost(domain)}/sitemap.xml`;
}

/**
 * Submit (or re-submit) a sitemap feed for a GSC property.
 * Google expects PUT with an empty body; both path segments are URL-encoded.
 */
async function putSitemap(
  accessToken: string,
  siteUrl: string,
  feedUrl: string
): Promise<void> {
  const encodedSite = encodeURIComponent(siteUrl);
  const encodedFeed = encodeURIComponent(feedUrl);
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/sitemaps/${encodedFeed}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(
      data.error?.message || `Sitemap submit failed (${res.status}) for ${feedUrl}`
    );
  }
}

async function querySearchAnalytics(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  hourly = false,
  now = new Date()
): Promise<{
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  startDate: string;
  endDate: string;
}> {
  const encoded = encodeURIComponent(siteUrl);
  const body = hourly
    ? {
        startDate,
        endDate,
        type: "web",
        aggregationType: "byProperty",
        dimensions: ["HOUR"],
        rowLimit: 25000,
        dataState: "hourly_all",
      }
    : {
        startDate,
        endDate,
        type: "web",
        aggregationType: "byProperty",
        dataState: "all",
      };

  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  const data = (await res.json()) as {
    rows?: GscAnalyticsRow[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(
      data.error?.message || `Search analytics failed for ${siteUrl}`
    );
  }
  const rows = data.rows ?? [];
  if (rows.length === 0) {
    return {
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
      startDate,
      endDate,
    };
  }

  if (!hourly) {
    const row = rows[0]!;
    return {
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
      startDate,
      endDate,
    };
  }

  const aggregated = aggregateHourlyMetrics(rows, now);
  return {
    clicks: aggregated.clicks,
    impressions: aggregated.impressions,
    ctr: aggregated.ctr,
    position: aggregated.position,
    startDate: aggregated.startDate || startDate,
    endDate: aggregated.endDate || endDate,
  };
}

type TopQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

async function queryTopQueries(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  hourly = false,
  now = new Date()
): Promise<TopQueryRow[]> {
  const encoded = encodeURIComponent(siteUrl);
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        hourly
          ? {
              startDate,
              endDate,
              type: "web",
              aggregationType: "byProperty",
              dimensions: ["query", "HOUR"],
              rowLimit: 25000,
              dataState: "hourly_all",
            }
          : {
              startDate,
              endDate,
              type: "web",
              aggregationType: "byProperty",
              dimensions: ["query"],
              rowLimit: 30,
              dataState: "all",
            }
      ),
    }
  );
  const data = (await res.json()) as {
    rows?: GscAnalyticsRow[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(
      data.error?.message || `Search query analytics failed for ${siteUrl}`
    );
  }
  const rows = data.rows ?? [];

  if (hourly) {
    return aggregateQueryHourlyRows(rows, 30, now);
  }

  return rows
    .map((row) => ({
      query: row.keys?.[0] ?? "",
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    }))
    .filter((row) => row.query.length > 0)
    .sort(
      (a, b) =>
        b.impressions - a.impressions ||
        b.clicks - a.clicks ||
        a.query.localeCompare(b.query)
    );
}

export const syncAllInternal = internalAction({
  args: {},
  handler: async (ctx) => {
    const connection = await ctx.runQuery(internal.gsc.getConnectionInternal, {});
    if (!connection) return { ok: false as const, error: "Not connected" };

    try {
      let accessToken = connection.accessToken;
      if (connection.accessTokenExpiresAt <= Date.now() + 60_000) {
        const refreshed = await refreshAccessToken(connection.refreshToken);
        await ctx.runMutation(internal.gsc.updateTokens, {
          connectionId: connection._id,
          accessToken: refreshed.accessToken,
          accessTokenExpiresAt: Date.now() + refreshed.expiresIn * 1000,
          refreshToken: refreshed.refreshToken,
        });
        accessToken = refreshed.accessToken;
      }

      await ctx.runMutation(internal.gsc.wipeGoogleSearchMetricsInternal, {});

      const properties = await listGscSites(accessToken);
      await ctx.runMutation(internal.gsc.stripGscPropertyOverrides, {});
      const sites = await ctx.runQuery(internal.gsc.listSitesInternal, {});
      const syncNow = new Date();

      for (const site of sites) {
        const property = matchGscProperty(site.domain, properties);

        if (!property) {
          await ctx.runMutation(internal.gsc.upsertPropertyStatus, {
            siteId: site._id as Id<"sites">,
            status: "not_in_console",
          });
          await ctx.runMutation(internal.gsc.clearSiteMetrics, {
            siteId: site._id as Id<"sites">,
          });
          continue;
        }

        await ctx.runMutation(internal.gsc.upsertPropertyStatus, {
          siteId: site._id as Id<"sites">,
          status: "matched",
          propertyUrl: property,
        });

        for (const periodDays of PERIODS) {
          const { startDate, endDate } = dateRangeForPeriod(periodDays, syncNow);
          const hourly = periodDays === 1;
          const stats = await querySearchAnalytics(
            accessToken,
            property,
            startDate,
            endDate,
            hourly,
            syncNow
          );
          await ctx.runMutation(internal.gsc.upsertMetric, {
            siteId: site._id as Id<"sites">,
            periodDays,
            gscPropertyUrl: property,
            clicks: stats.clicks,
            impressions: stats.impressions,
            ctr: stats.ctr,
            position: stats.position,
            startDate: stats.startDate,
            endDate: stats.endDate,
          });

          const queries = await queryTopQueries(
            accessToken,
            property,
            startDate,
            endDate,
            hourly,
            syncNow
          );
          await ctx.runMutation(internal.gsc.upsertQueries, {
            siteId: site._id as Id<"sites">,
            periodDays,
            queries,
          });
        }
      }

      await ctx.runMutation(internal.gsc.setSyncResult, {
        connectionId: connection._id,
        error: null,
      });
      return { ok: true as const };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await ctx.runMutation(internal.gsc.setSyncResult, {
        connectionId: connection._id,
        error: message,
      });
      return { ok: false as const, error: message };
    }
  },
});

export const syncNow = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const connection = await ctx.runQuery(internal.gsc.getConnectionInternal, {});
    if (!connection) throw new Error("Google Search Console is not connected");

    const result = await ctx.runAction(internal.gscActions.syncAllInternal, {});
    if (!result.ok) {
      throw new Error(result.error || "Sync failed");
    }
    return { ok: true };
  },
});

export type SitemapSubmitResult = {
  slug: string;
  domain: string;
  feedUrl: string;
  status: "submitted" | "skipped" | "error";
  detail?: string;
};

/**
 * Submit each cleaning site's sitemap.xml to Google Search Console for every
 * property that matches a seeded site domain.
 * Requires full `webmasters` scope — reconnect Google after upgrading from readonly.
 */
export const submitSitemaps = action({
  args: {},
  handler: async (ctx): Promise<{ results: SitemapSubmitResult[] }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const connection = await ctx.runQuery(internal.gsc.getConnectionInternal, {});
    if (!connection) throw new Error("Google Search Console is not connected");

    let accessToken = connection.accessToken;
    if (connection.accessTokenExpiresAt <= Date.now() + 60_000) {
      const refreshed = await refreshAccessToken(connection.refreshToken);
      await ctx.runMutation(internal.gsc.updateTokens, {
        connectionId: connection._id,
        accessToken: refreshed.accessToken,
        accessTokenExpiresAt: Date.now() + refreshed.expiresIn * 1000,
        refreshToken: refreshed.refreshToken,
      });
      accessToken = refreshed.accessToken;
    }

    const properties = await listGscSites(accessToken);
    const sites = await ctx.runQuery(internal.gsc.listSitesInternal, {});
    const results: SitemapSubmitResult[] = [];

    for (const site of sites) {
      const feedUrl = sitemapFeedUrl(site.domain);
      const property = matchGscProperty(site.domain, properties);
      if (!property) {
        results.push({
          slug: site.slug,
          domain: site.domain,
          feedUrl,
          status: "skipped",
          detail: "Site not verified in Search Console for this Google account",
        });
        continue;
      }

      try {
        await putSitemap(accessToken, property, feedUrl);
        results.push({
          slug: site.slug,
          domain: site.domain,
          feedUrl,
          status: "submitted",
          detail: property,
        });
      } catch (e) {
        results.push({
          slug: site.slug,
          domain: site.domain,
          feedUrl,
          status: "error",
          detail: e instanceof Error ? e.message : "Submit failed",
        });
      }
    }

    return { results };
  },
});

// ---------------------------------------------------------------------------
// URL Inspection API (index coverage discovery)
// Scope: existing `webmasters` — reconnect if Google returns insufficient scope.
// Quota: ~2,000 inspections/day per project; callers should rate-limit.
// ---------------------------------------------------------------------------

const URL_INSPECTION_ENDPOINT =
  "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";

/** Default polite delay between inspections (ms). */
const DEFAULT_INSPECT_DELAY_MS = 250;

export type UrlInspectionResult = {
  inspectionUrl: string;
  siteSlug?: string;
  siteUrl?: string;
  ok: boolean;
  verdict?: string;
  coverageState?: string;
  indexingState?: string;
  robotsTxtState?: string;
  pageFetchState?: string;
  lastCrawlTime?: string;
  referringUrls?: string[];
  sitemap?: string[];
  googleCanonical?: string;
  userCanonical?: string;
  crawledAs?: string;
  error?: string;
  /** True when OAuth scope cannot call URL Inspection — reconnect Google. */
  insufficientScope?: boolean;
};

export type PageAnalyticsRow = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type SiteSlugDomain = { slug: string; domain: string };

export type InspectUrlsResult =
  | {
      ok: false;
      error: string;
      results: UrlInspectionResult[];
      skipped: string[];
      reconnectHint: string | null;
      propertyStatus?: "not_in_console";
    }
  | {
      ok: true;
      property: string;
      results: UrlInspectionResult[];
      skipped: string[];
      intentionalNoindexSkipped: number;
      quotaSkipped: number;
      reconnectHint: string | null;
      propertyStatus: "matched";
    };

export type InspectSitemapsSiteReport = {
  slug: string;
  domain: string;
  status: string;
  detail?: string;
  property?: string;
  results: UrlInspectionResult[];
  sitemapUrlCount: number;
  inspectedCount: number;
  intentionalNoindexSkipped: number;
};

export type InspectSitemapsResult =
  | {
      ok: false;
      error: string;
      sites: InspectSitemapsSiteReport[];
      reconnectHint: string | null;
    }
  | {
      ok: true;
      sites: InspectSitemapsSiteReport[];
      reconnectHint: string | null;
      inspectedTotal: number;
    };

export type QueryPages28dResult =
  | {
      ok: false;
      error: string;
      rows: PageAnalyticsRow[];
      propertyStatus?: "not_in_console";
    }
  | {
      ok: true;
      property: string;
      startDate: string;
      endDate: string;
      rows: PageAnalyticsRow[];
    };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type TokenConnection = {
  _id: Id<"gscConnections">;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
};

async function ensureAccessToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- action ctx runMutation
  ctx: { runMutation: (ref: any, args: any) => Promise<any> },
  connection: TokenConnection
): Promise<string> {
  if (connection.accessTokenExpiresAt > Date.now() + 60_000) {
    return connection.accessToken;
  }
  const refreshed = await refreshAccessToken(connection.refreshToken);
  await ctx.runMutation(internal.gsc.updateTokens, {
    connectionId: connection._id,
    accessToken: refreshed.accessToken,
    accessTokenExpiresAt: Date.now() + refreshed.expiresIn * 1000,
    refreshToken: refreshed.refreshToken,
  });
  return refreshed.accessToken;
}

function isInsufficientScopeError(status: number, message: string): boolean {
  if (status === 403 && /insufficient|scope|ACCESS_TOKEN_SCOPE/i.test(message)) {
    return true;
  }
  return /insufficient.?scope|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(message);
}

async function inspectOneUrl(
  accessToken: string,
  inspectionUrl: string,
  siteUrl: string,
  languageCode: string
): Promise<UrlInspectionResult> {
  const res = await fetch(URL_INSPECTION_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inspectionUrl,
      siteUrl,
      languageCode,
    }),
  });

  const data = (await res.json()) as {
    inspectionResult?: {
      indexStatusResult?: {
        verdict?: string;
        coverageState?: string;
        robotsTxtState?: string;
        indexingState?: string;
        lastCrawlTime?: string;
        pageFetchState?: string;
        googleCanonical?: string;
        userCanonical?: string;
        crawledAs?: string;
        referringUrls?: string[];
        sitemap?: string[];
      };
    };
    error?: {
      code?: number;
      message?: string;
      status?: string;
    };
  };

  if (!res.ok) {
    const message =
      data.error?.message ||
      `URL Inspection failed (${res.status}) for ${inspectionUrl}`;
    return {
      inspectionUrl,
      siteUrl,
      ok: false,
      error: message,
      insufficientScope: isInsufficientScopeError(res.status, message),
    };
  }

  const index = data.inspectionResult?.indexStatusResult ?? {};
  return {
    inspectionUrl,
    siteUrl,
    ok: true,
    verdict: index.verdict,
    coverageState: index.coverageState,
    indexingState: index.indexingState,
    robotsTxtState: index.robotsTxtState,
    pageFetchState: index.pageFetchState,
    lastCrawlTime: index.lastCrawlTime,
    referringUrls: index.referringUrls,
    sitemap: index.sitemap,
    googleCanonical: index.googleCanonical,
    userCanonical: index.userCanonical,
    crawledAs: index.crawledAs,
  };
}

async function fetchSitemapUrls(domain: string): Promise<string[]> {
  const feedUrl = sitemapFeedUrl(domain);
  const res = await fetch(feedUrl, {
    headers: { Accept: "application/xml,text/xml,*/*" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch sitemap ${feedUrl} (${res.status})`);
  }
  const xml = await res.text();
  const locs = parseSitemapLocs(xml);
  const isIndex =
    /<sitemapindex[\s>]/i.test(xml) ||
    locs.some((u) => /sitemap/i.test(u) && u.endsWith(".xml"));

  if (!isIndex) return locs;

  const childUrls: string[] = [];
  for (const child of locs) {
    const childRes = await fetch(child, {
      headers: { Accept: "application/xml,text/xml,*/*" },
    });
    if (!childRes.ok) continue;
    childUrls.push(...parseSitemapLocs(await childRes.text()));
  }
  return childUrls;
}

/**
 * Inspect a list of URLs against a GSC property (from site slug or explicit siteUrl).
 * Rate-limits between calls. Skips intentional noindex URLs when siteSlug is set.
 */
export const inspectUrlsInternal = internalAction({
  args: {
    urls: v.array(v.string()),
    siteSlug: v.optional(v.string()),
    /** GSC property URL override (e.g. sc-domain:example.com or https://…). */
    siteUrl: v.optional(v.string()),
    delayMs: v.optional(v.number()),
    languageCode: v.optional(v.string()),
    /** Cap inspections in this call (remaining URLs returned as skipped). */
    maxUrls: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<InspectUrlsResult> => {
    const connection = await ctx.runQuery(internal.gsc.getConnectionInternal, {});
    if (!connection) {
      return {
        ok: false,
        error: "Google Search Console is not connected",
        results: [],
        skipped: [],
        reconnectHint: null,
      };
    }

    let accessToken: string;
    try {
      accessToken = await ensureAccessToken(ctx, connection);
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Token refresh failed",
        results: [],
        skipped: [],
        reconnectHint: null,
      };
    }

    const properties = await listGscSites(accessToken);
    const sites = (await ctx.runQuery(
      internal.gsc.listSitesInternal,
      {}
    )) as SiteSlugDomain[];
    const site = args.siteSlug
      ? sites.find((s) => s.slug === args.siteSlug)
      : undefined;

    let property = args.siteUrl?.trim() || null;
    if (!property && site) {
      property = matchGscProperty(site.domain, properties);
    }
    if (!property && args.urls[0]) {
      try {
        property = matchGscProperty(new URL(args.urls[0]).hostname, properties);
      } catch {
        /* ignore */
      }
    }

    if (!property) {
      return {
        ok: false,
        error: args.siteSlug
          ? `Site "${args.siteSlug}" not verified in Search Console (not_in_console)`
          : "Could not resolve a GSC property for these URLs",
        results: [],
        skipped: args.urls,
        reconnectHint: null,
        propertyStatus: "not_in_console",
      };
    }

    const delayMs = Math.max(0, args.delayMs ?? DEFAULT_INSPECT_DELAY_MS);
    const languageCode = args.languageCode ?? "en-US";
    const siteSlugForFilter = args.siteSlug ?? site?.slug;
    const filtered = args.urls.filter(
      (u) => !isIntentionalNoindexUrl(u, siteSlugForFilter)
    );
    const intentionalSkipped: string[] = args.urls.filter((u) =>
      isIntentionalNoindexUrl(u, siteSlugForFilter)
    );
    const maxUrls = args.maxUrls ?? filtered.length;
    const toInspect = filtered.slice(0, maxUrls);
    const quotaSkipped = filtered.slice(maxUrls);

    const results: UrlInspectionResult[] = [];
    let reconnectHint: string | null = null;

    for (let i = 0; i < toInspect.length; i++) {
      const url = toInspect[i]!;
      const result = await inspectOneUrl(
        accessToken,
        url,
        property,
        languageCode
      );
      result.siteSlug = siteSlugForFilter;
      results.push(result);
      if (result.insufficientScope) {
        reconnectHint =
          "URL Inspection requires the full webmasters OAuth scope. Disconnect Google in Booking Broom SEO settings, revoke the app at https://myaccount.google.com/permissions if needed, then reconnect with consent.";
        break;
      }
      if (i < toInspect.length - 1 && delayMs > 0) {
        await sleep(delayMs);
      }
    }

    return {
      ok: true,
      property,
      results,
      skipped: [...intentionalSkipped, ...quotaSkipped],
      intentionalNoindexSkipped: intentionalSkipped.length,
      quotaSkipped: quotaSkipped.length,
      reconnectHint,
      propertyStatus: "matched",
    };
  },
});
/**
 * Fetch live sitemap.xml for one or more site slugs, filter intentional noindex
 * URLs, and run URL Inspection under an optional daily quota cap.
 */
export const inspectSitemapsInternal = internalAction({
  args: {
    slugs: v.array(v.string()),
    delayMs: v.optional(v.number()),
    languageCode: v.optional(v.string()),
    /** Hard cap across all sites in this invocation (default: no cap). */
    maxUrls: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<InspectSitemapsResult> => {
    const connection = await ctx.runQuery(internal.gsc.getConnectionInternal, {});
    if (!connection) {
      return {
        ok: false,
        error: "Google Search Console is not connected",
        sites: [],
        reconnectHint: null,
      };
    }

    let accessToken: string;
    try {
      accessToken = await ensureAccessToken(ctx, connection);
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Token refresh failed",
        sites: [],
        reconnectHint: null,
      };
    }

    const properties = await listGscSites(accessToken);
    const allSites = (await ctx.runQuery(
      internal.gsc.listSitesInternal,
      {}
    )) as SiteSlugDomain[];
    const delayMs = Math.max(0, args.delayMs ?? DEFAULT_INSPECT_DELAY_MS);
    const languageCode = args.languageCode ?? "en-US";
    let remaining = args.maxUrls ?? Number.POSITIVE_INFINITY;
    let reconnectHint: string | null = null;

    const siteReports: InspectSitemapsSiteReport[] = [];

    for (const slug of args.slugs) {
      const site = allSites.find((s) => s.slug === slug);
      if (!site) {
        siteReports.push({
          slug,
          domain: "",
          status: "unknown_slug",
          detail: "Slug not found in seeded sites",
          results: [],
          sitemapUrlCount: 0,
          inspectedCount: 0,
          intentionalNoindexSkipped: 0,
        });
        continue;
      }

      const property = matchGscProperty(site.domain, properties);
      if (!property) {
        siteReports.push({
          slug,
          domain: site.domain,
          status: "not_in_console",
          detail: "Skip URL Inspection until the property is verified in GSC",
          results: [],
          sitemapUrlCount: 0,
          inspectedCount: 0,
          intentionalNoindexSkipped: 0,
        });
        continue;
      }

      if (remaining <= 0) {
        siteReports.push({
          slug,
          domain: site.domain,
          status: "quota_exhausted",
          detail: "Daily inspection quota cap reached for this run",
          property,
          results: [],
          sitemapUrlCount: 0,
          inspectedCount: 0,
          intentionalNoindexSkipped: 0,
        });
        continue;
      }

      let sitemapUrls: string[];
      try {
        sitemapUrls = await fetchSitemapUrls(site.domain);
      } catch (e) {
        siteReports.push({
          slug,
          domain: site.domain,
          status: "sitemap_error",
          detail: e instanceof Error ? e.message : "Sitemap fetch failed",
          property,
          results: [],
          sitemapUrlCount: 0,
          inspectedCount: 0,
          intentionalNoindexSkipped: 0,
        });
        continue;
      }

      const intentional = sitemapUrls.filter((u) =>
        isIntentionalNoindexUrl(u, slug)
      );
      const eligible = sitemapUrls.filter(
        (u) => !isIntentionalNoindexUrl(u, slug)
      );
      const toInspect = eligible.slice(0, remaining);
      remaining -= toInspect.length;

      const results: UrlInspectionResult[] = [];
      for (let i = 0; i < toInspect.length; i++) {
        const url = toInspect[i]!;
        const result = await inspectOneUrl(
          accessToken,
          url,
          property,
          languageCode
        );
        result.siteSlug = slug;
        results.push(result);
        if (result.insufficientScope) {
          reconnectHint =
            "URL Inspection requires the full webmasters OAuth scope. Disconnect Google in Booking Broom SEO settings, revoke the app at https://myaccount.google.com/permissions if needed, then reconnect with consent.";
          break;
        }
        if (i < toInspect.length - 1 && delayMs > 0) {
          await sleep(delayMs);
        }
      }

      siteReports.push({
        slug,
        domain: site.domain,
        status: reconnectHint ? "insufficient_scope" : "inspected",
        property,
        results,
        sitemapUrlCount: sitemapUrls.length,
        inspectedCount: results.length,
        intentionalNoindexSkipped: intentional.length,
        detail:
          eligible.length > toInspect.length
            ? `Prioritized ${toInspect.length} of ${eligible.length} eligible URLs (quota)`
            : undefined,
      });

      if (reconnectHint) break;
    }

    return {
      ok: true,
      sites: siteReports,
      reconnectHint,
      inspectedTotal: siteReports.reduce((n, s) => n + s.inspectedCount, 0),
    };
  },
});

/** Manager-facing wrapper around inspectUrlsInternal. */
export const inspectUrls = action({
  args: {
    urls: v.array(v.string()),
    siteSlug: v.optional(v.string()),
    siteUrl: v.optional(v.string()),
    delayMs: v.optional(v.number()),
    languageCode: v.optional(v.string()),
    maxUrls: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<InspectUrlsResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const connection = await ctx.runQuery(internal.gsc.getConnectionInternal, {});
    if (!connection) throw new Error("Google Search Console is not connected");

    return (await ctx.runAction(
      internal.gscActions.inspectUrlsInternal,
      args
    )) as InspectUrlsResult;
  },
});

/** Manager-facing sitemap inspection for one or more slugs. */
export const inspectSitemaps = action({
  args: {
    slugs: v.array(v.string()),
    delayMs: v.optional(v.number()),
    languageCode: v.optional(v.string()),
    maxUrls: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<InspectSitemapsResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const connection = await ctx.runQuery(internal.gsc.getConnectionInternal, {});
    if (!connection) throw new Error("Google Search Console is not connected");

    return (await ctx.runAction(
      internal.gscActions.inspectSitemapsInternal,
      args
    )) as InspectSitemapsResult;
  },
});

/**
 * Secondary signal: Search Analytics with `page` dimension for the last 28 days.
 * Pages with impressions are almost certainly indexed (weak positive only).
 */
export const queryPages28dInternal = internalAction({
  args: {
    siteSlug: v.string(),
    rowLimit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<QueryPages28dResult> => {
    const connection = await ctx.runQuery(internal.gsc.getConnectionInternal, {});
    if (!connection) {
      return { ok: false, error: "Not connected", rows: [] };
    }

    let accessToken: string;
    try {
      accessToken = await ensureAccessToken(ctx, connection);
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Token refresh failed",
        rows: [],
      };
    }

    const properties = await listGscSites(accessToken);
    const sites = (await ctx.runQuery(
      internal.gsc.listSitesInternal,
      {}
    )) as SiteSlugDomain[];
    const site = sites.find((s) => s.slug === args.siteSlug);
    if (!site) {
      return { ok: false, error: `Unknown slug ${args.siteSlug}`, rows: [] };
    }

    const property = matchGscProperty(site.domain, properties);
    if (!property) {
      return {
        ok: false,
        error: "not_in_console",
        rows: [],
        propertyStatus: "not_in_console",
      };
    }

    const { startDate, endDate } = dateRangeForPeriod(28, new Date());
    const encoded = encodeURIComponent(property);
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate,
          endDate,
          type: "web",
          aggregationType: "byPage",
          dimensions: ["page"],
          rowLimit: args.rowLimit ?? 25000,
          dataState: "all",
        }),
      }
    );

    const data = (await res.json()) as {
      rows?: GscAnalyticsRow[];
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        ok: false,
        error: data.error?.message || `Page analytics failed for ${property}`,
        rows: [],
      };
    }

    const rows: PageAnalyticsRow[] = (data.rows ?? [])
      .map((row) => ({
        page: row.keys?.[0] ?? "",
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      }))
      .filter((r) => r.page.length > 0)
      .sort(
        (a, b) =>
          b.impressions - a.impressions ||
          b.clicks - a.clicks ||
          a.page.localeCompare(b.page)
      );

    return {
      ok: true,
      property,
      startDate,
      endDate,
      rows,
    };
  },
});
