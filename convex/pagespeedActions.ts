import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const STRATEGIES = ["mobile", "desktop"] as const;

type Strategy = (typeof STRATEGIES)[number];

type PsiAudit = {
  numericValue?: number;
  score?: number | null;
};

type PsiResponse = {
  lighthouseResult?: {
    finalUrl?: string;
    categories?: {
      performance?: { score?: number | null };
      accessibility?: { score?: number | null };
      "best-practices"?: { score?: number | null };
      seo?: { score?: number | null };
    };
    audits?: Record<string, PsiAudit>;
  };
  loadingExperience?: {
    overall_category?: string;
  };
  error?: {
    message?: string;
    code?: number;
  };
};

function scoreTo100(score: number | null | undefined): number | undefined {
  if (score == null || Number.isNaN(score)) return undefined;
  return Math.round(score * 100);
}

function siteUrl(domain: string, performanceUrl?: string): string {
  const override = performanceUrl?.trim();
  if (override) {
    if (/^https?:\/\//i.test(override)) return override;
    return `https://${override.replace(/^\/+/, "")}`;
  }
  return `https://${domain.replace(/^https?:\/\//i, "").replace(/\/$/, "")}`;
}

async function runPagespeed(
  url: string,
  strategy: Strategy,
  apiKey: string | undefined
): Promise<{
  url: string;
  performanceScore?: number;
  accessibilityScore?: number;
  bestPracticesScore?: number;
  seoScore?: number;
  lcpMs?: number;
  cls?: number;
  inpMs?: number;
  fcpMs?: number;
  overallCategory?: string;
  error?: string;
}> {
  const params = new URLSearchParams({ url, strategy });
  for (const category of [
    "performance",
    "accessibility",
    "best-practices",
    "seo",
  ] as const) {
    params.append("category", category);
  }
  if (apiKey) params.set("key", apiKey);

  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`;
  const res = await fetch(endpoint);
  const data = (await res.json()) as PsiResponse;

  if (!res.ok) {
    return {
      url,
      error:
        data.error?.message ||
        `PageSpeed request failed (${res.status}) for ${url}`,
    };
  }

  const lh = data.lighthouseResult;
  if (!lh) {
    return { url, error: `No Lighthouse result for ${url}` };
  }

  const audits = lh.audits ?? {};
  const categories = lh.categories ?? {};

  return {
    url: lh.finalUrl || url,
    performanceScore: scoreTo100(categories.performance?.score),
    accessibilityScore: scoreTo100(categories.accessibility?.score),
    bestPracticesScore: scoreTo100(categories["best-practices"]?.score),
    seoScore: scoreTo100(categories.seo?.score),
    lcpMs: audits["largest-contentful-paint"]?.numericValue,
    cls: audits["cumulative-layout-shift"]?.numericValue,
    inpMs:
      audits["interaction-to-next-paint"]?.numericValue ??
      audits["total-blocking-time"]?.numericValue,
    fcpMs: audits["first-contentful-paint"]?.numericValue,
    overallCategory: data.loadingExperience?.overall_category,
  };
}

export const syncAllInternal = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    ok: boolean;
    error: string | null;
    sites: number;
  }> => {
    const apiKey = process.env.PAGESPEED_API_KEY?.trim() || undefined;
    const sites: Array<{
      _id: Id<"sites">;
      domain: string;
      slug: string;
      performanceUrl?: string;
    }> = await ctx.runQuery(internal.pagespeed.listSitesInternal, {});

    const errors: string[] = [];

    for (const site of sites) {
      const url = siteUrl(site.domain, site.performanceUrl);
      for (const strategy of STRATEGIES) {
        try {
          const result = await runPagespeed(url, strategy, apiKey);
          await ctx.runMutation(internal.pagespeed.upsertMetric, {
            siteId: site._id,
            strategy,
            url: result.url,
            performanceScore: result.performanceScore,
            accessibilityScore: result.accessibilityScore,
            bestPracticesScore: result.bestPracticesScore,
            seoScore: result.seoScore,
            lcpMs: result.lcpMs,
            cls: result.cls,
            inpMs: result.inpMs,
            fcpMs: result.fcpMs,
            overallCategory: result.overallCategory,
            error: result.error,
          });
          if (result.error) {
            errors.push(`${site.slug}/${strategy}: ${result.error}`);
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : "PageSpeed failed";
          errors.push(`${site.slug}/${strategy}: ${message}`);
          await ctx.runMutation(internal.pagespeed.upsertMetric, {
            siteId: site._id,
            strategy,
            url,
            error: message,
          });
        }
      }
    }

    const summary =
      errors.length > 0
        ? errors.slice(0, 5).join("; ") +
          (errors.length > 5 ? ` (+${errors.length - 5} more)` : "")
        : null;

    await ctx.runMutation(internal.pagespeed.setSyncResult, {
      error: summary,
    });

    return {
      ok: errors.length === 0,
      error: summary,
      sites: sites.length,
    };
  },
});

export const syncNow = action({
  args: {},
  handler: async (
    ctx
  ): Promise<{ ok: boolean; error: string | null; sites: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const result: { ok: boolean; error: string | null; sites: number } =
      await ctx.runAction(internal.pagespeedActions.syncAllInternal, {});
    if (!result.ok && result.error) {
      const allFailed =
        result.error.includes("API key") ||
        result.error.toLowerCase().includes("quota");
      if (allFailed) {
        throw new Error(result.error);
      }
    }
    return result;
  },
});

export const syncSite = action({
  args: {
    siteId: v.id("sites"),
    strategy: v.optional(
      v.union(v.literal("mobile"), v.literal("desktop"), v.literal("both"))
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ ok: true; errors: string[] }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const apiKey = process.env.PAGESPEED_API_KEY?.trim() || undefined;
    const sites: Array<{
      _id: Id<"sites">;
      domain: string;
      slug: string;
      performanceUrl?: string;
    }> = await ctx.runQuery(internal.pagespeed.listSitesInternal, {});
    const site = sites.find((s) => s._id === args.siteId);
    if (!site) throw new Error("Site not found");

    const url = siteUrl(site.domain, site.performanceUrl);
    const strategies: Strategy[] =
      args.strategy === "mobile" || args.strategy === "desktop"
        ? [args.strategy]
        : [...STRATEGIES];

    const errors: string[] = [];
    for (const strategy of strategies) {
      try {
        const result = await runPagespeed(url, strategy, apiKey);
        await ctx.runMutation(internal.pagespeed.upsertMetric, {
          siteId: site._id,
          strategy,
          url: result.url,
          performanceScore: result.performanceScore,
          accessibilityScore: result.accessibilityScore,
          bestPracticesScore: result.bestPracticesScore,
          seoScore: result.seoScore,
          lcpMs: result.lcpMs,
          cls: result.cls,
          inpMs: result.inpMs,
          fcpMs: result.fcpMs,
          overallCategory: result.overallCategory,
          error: result.error,
        });
        if (result.error) errors.push(result.error);
      } catch (e) {
        const message = e instanceof Error ? e.message : "PageSpeed failed";
        errors.push(message);
        await ctx.runMutation(internal.pagespeed.upsertMetric, {
          siteId: site._id,
          strategy,
          url,
          error: message,
        });
      }
    }

    if (errors.length === strategies.length) {
      throw new Error(errors[0] || "PageSpeed sync failed");
    }

    return { ok: true as const, errors };
  },
});
