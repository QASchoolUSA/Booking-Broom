import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  dateRangeForBingPeriod,
  matchBingProperty,
  parseBingDate,
} from "./lib/gscMatch";

const PERIODS = [1, 2, 7, 28, 90] as const;
const CRAWL_ISSUES_CAP = 25;

function requireBingApiKey(): string {
  const key = process.env.BING_WEBMASTER_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "Bing Webmaster is not configured. Set BING_WEBMASTER_API_KEY in Convex env."
    );
  }
  return key;
}

type DailyStat = { date: string; clicks: number; impressions: number };

type CrawlIssueRow = {
  url: string;
  httpCode: number;
  issues: number;
  inLinks: number;
};

async function bingJson<T>(
  method: string,
  apiKey: string,
  params: Record<string, string> = {}
): Promise<T> {
  const qs = new URLSearchParams({ apikey: apiKey, ...params });
  const res = await fetch(
    `https://ssl.bing.com/webmaster/api.svc/json/${method}?${qs.toString()}`,
    {
      headers: { Accept: "application/json" },
    }
  );
  const data = (await res.json()) as T & {
    Message?: string;
    ErrorCode?: number;
  };
  if (!res.ok) {
    throw new Error(
      (data as { Message?: string }).Message ||
        `Bing API ${method} failed (${res.status})`
    );
  }
  if (
    typeof (data as { ErrorCode?: number }).ErrorCode === "number" &&
    (data as { ErrorCode: number }).ErrorCode !== 0
  ) {
    throw new Error(
      (data as { Message?: string }).Message ||
        `Bing API ${method} error ${(data as { ErrorCode: number }).ErrorCode}`
    );
  }
  return data;
}

async function listBingSites(apiKey: string): Promise<string[]> {
  const data = await bingJson<{
    d?: { Url?: string; __type?: string }[] | { Url?: string };
  }>("GetUserSites", apiKey);

  const raw = data.d;
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((s) => s.Url)
    .filter((u): u is string => typeof u === "string" && u.length > 0);
}

async function getRankAndTrafficStats(
  apiKey: string,
  siteUrl: string
): Promise<DailyStat[]> {
  const data = await bingJson<{
    d?: {
      Clicks?: number;
      Impressions?: number;
      Date?: string;
    }[];
  }>("GetRankAndTrafficStats", apiKey, { siteUrl });

  const rows = data.d ?? [];
  const out: DailyStat[] = [];
  for (const row of rows) {
    if (!row.Date) continue;
    const date = parseBingDate(row.Date);
    if (!date) continue;
    out.push({
      date,
      clicks: row.Clicks ?? 0,
      impressions: row.Impressions ?? 0,
    });
  }
  return out;
}

function aggregatePeriod(
  daily: DailyStat[],
  startDate: string,
  endDate: string
): { clicks: number; impressions: number; ctr: number } {
  let clicks = 0;
  let impressions = 0;
  for (const row of daily) {
    if (row.date < startDate || row.date > endDate) continue;
    clicks += row.clicks;
    impressions += row.impressions;
  }
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
  };
}

async function getCrawlIssues(
  apiKey: string,
  siteUrl: string
): Promise<CrawlIssueRow[]> {
  const data = await bingJson<{
    d?: {
      Url?: string;
      HttpCode?: number;
      Issues?: number;
      InLinks?: number;
    }[];
  }>("GetCrawlIssues", apiKey, { siteUrl });

  const rows = data.d ?? [];
  return rows
    .map((r) => ({
      url: r.Url ?? "",
      httpCode: r.HttpCode ?? 0,
      issues: r.Issues ?? 0,
      inLinks: r.InLinks ?? 0,
    }))
    .filter((r) => r.url.length > 0)
    .slice(0, CRAWL_ISSUES_CAP);
}

export const syncAllInternal = internalAction({
  args: {},
  handler: async (ctx) => {
    let apiKey: string;
    try {
      apiKey = requireBingApiKey();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Missing API key";
      await ctx.runMutation(internal.bing.setSyncResult, { error: message });
      return { ok: false as const, error: message };
    }

    try {
      const properties = await listBingSites(apiKey);
      const sites = await ctx.runQuery(internal.bing.listSitesInternal, {});
      const siteErrors: string[] = [];

      for (const site of sites) {
        const property = matchBingProperty(
          site.domain,
          properties,
          site.bingPropertyUrl
        );

        if (!property) {
          await ctx.runMutation(internal.bing.upsertPropertyStatus, {
            siteId: site._id as Id<"sites">,
            status: "not_in_console",
          });
          await ctx.runMutation(internal.bing.clearSiteMetrics, {
            siteId: site._id as Id<"sites">,
          });
          continue;
        }

        await ctx.runMutation(internal.bing.upsertPropertyStatus, {
          siteId: site._id as Id<"sites">,
          status: "matched",
          propertyUrl: property,
        });

        try {
          const daily = await getRankAndTrafficStats(apiKey, property);
          for (const periodDays of PERIODS) {
            const { startDate, endDate } = dateRangeForBingPeriod(periodDays);
            const stats = aggregatePeriod(daily, startDate, endDate);
            await ctx.runMutation(internal.bing.upsertMetric, {
              siteId: site._id as Id<"sites">,
              periodDays,
              bingPropertyUrl: property,
              clicks: stats.clicks,
              impressions: stats.impressions,
              ctr: stats.ctr,
              position: 0,
              startDate,
              endDate,
            });
          }

          const issues = await getCrawlIssues(apiKey, property);
          await ctx.runMutation(internal.bing.upsertCrawlIssues, {
            siteId: site._id as Id<"sites">,
            issueCount: issues.length,
            issues,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Site sync failed";
          siteErrors.push(`${site.slug}: ${message}`);
        }
      }

      const error =
        siteErrors.length > 0 ? siteErrors.slice(0, 5).join("; ") : null;
      await ctx.runMutation(internal.bing.setSyncResult, { error });
      return error
        ? { ok: false as const, error }
        : { ok: true as const };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Bing sync failed";
      await ctx.runMutation(internal.bing.setSyncResult, { error: message });
      return { ok: false as const, error: message };
    }
  },
});

export const syncNow = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    requireBingApiKey();

    const result = await ctx.runAction(internal.bingActions.syncAllInternal, {});
    if (!result.ok) {
      throw new Error(result.error || "Bing sync failed");
    }
    return { ok: true };
  },
});
