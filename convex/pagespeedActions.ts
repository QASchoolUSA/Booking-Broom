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

type PsiAuditRef = {
  id: string;
  weight?: number;
};

type PsiCategory = {
  score?: number | null;
  auditRefs?: PsiAuditRef[];
};

type PsiResponse = {
  lighthouseResult?: {
    finalUrl?: string;
    categories?: {
      performance?: PsiCategory;
      accessibility?: PsiCategory;
      "best-practices"?: PsiCategory;
      seo?: PsiCategory;
      "agentic-browsing"?: PsiCategory;
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

/** Fractional pass ratio for Agentic Browsing (weighted audits that apply). */
function agenticFraction(
  category: PsiCategory | undefined,
  audits: Record<string, PsiAudit>
): { score?: number; passed?: number; total?: number } {
  if (!category) return {};
  const refs = (category.auditRefs ?? []).filter((r) => (r.weight ?? 0) > 0);
  if (refs.length === 0) {
    return { score: scoreTo100(category.score) };
  }
  let passed = 0;
  for (const ref of refs) {
    const auditScore = audits[ref.id]?.score;
    if (auditScore != null && auditScore >= 0.9) passed += 1;
  }
  return {
    score: scoreTo100(category.score) ?? Math.round((passed / refs.length) * 100),
    passed,
    total: refs.length,
  };
}

function siteUrl(domain: string, performanceUrl?: string): string {
  const override = performanceUrl?.trim();
  if (override) {
    if (/^https?:\/\//i.test(override)) return override;
    return `https://${override.replace(/^\/+/, "")}`;
  }
  return `https://${domain.replace(/^https?:\/\//i, "").replace(/\/$/, "")}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatPsiError(message: string | undefined, status: number): string {
  const raw = message || `PageSpeed request failed (${status})`;
  if (/referer/i.test(raw) && /blocked/i.test(raw)) {
    return (
      `${raw} Fix: in Google Cloud → Credentials, set this API key’s ` +
      `Application restrictions to None (server keys can’t use HTTP referrers).`
    );
  }
  return raw;
}

function isRetryablePsiError(status: number, message: string | undefined): boolean {
  if (status === 429 || status >= 500) return true;
  // Google occasionally returns referer-blocked 403s under load even when the
  // key is correctly unrestricted; a short retry usually succeeds.
  if (status === 403 && message && /referer/i.test(message)) return true;
  return false;
}

type PagespeedResult = {
  url: string;
  performanceScore?: number;
  accessibilityScore?: number;
  bestPracticesScore?: number;
  seoScore?: number;
  agenticBrowsingScore?: number;
  agenticBrowsingPassed?: number;
  agenticBrowsingTotal?: number;
  lcpMs?: number;
  cls?: number;
  inpMs?: number;
  fcpMs?: number;
  overallCategory?: string;
  error?: string;
};

async function runPagespeedOnce(
  url: string,
  strategy: Strategy,
  apiKey: string | undefined
): Promise<PagespeedResult & { status?: number }> {
  const params = new URLSearchParams({ url, strategy });
  for (const category of [
    "performance",
    "accessibility",
    "best-practices",
    "seo",
    "agentic-browsing",
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
      status: res.status,
      error: formatPsiError(data.error?.message, res.status),
    };
  }

  const lh = data.lighthouseResult;
  if (!lh) {
    return { url, error: `No Lighthouse result for ${url}` };
  }

  const audits = lh.audits ?? {};
  const categories = lh.categories ?? {};
  const agentic = agenticFraction(categories["agentic-browsing"], audits);

  return {
    url: lh.finalUrl || url,
    performanceScore: scoreTo100(categories.performance?.score),
    accessibilityScore: scoreTo100(categories.accessibility?.score),
    bestPracticesScore: scoreTo100(categories["best-practices"]?.score),
    seoScore: scoreTo100(categories.seo?.score),
    agenticBrowsingScore: agentic.score,
    agenticBrowsingPassed: agentic.passed,
    agenticBrowsingTotal: agentic.total,
    lcpMs: audits["largest-contentful-paint"]?.numericValue,
    cls: audits["cumulative-layout-shift"]?.numericValue,
    inpMs:
      audits["interaction-to-next-paint"]?.numericValue ??
      audits["total-blocking-time"]?.numericValue,
    fcpMs: audits["first-contentful-paint"]?.numericValue,
    overallCategory: data.loadingExperience?.overall_category,
  };
}

async function runPagespeed(
  url: string,
  strategy: Strategy,
  apiKey: string | undefined
): Promise<PagespeedResult> {
  const maxAttempts = 3;
  let last: PagespeedResult = { url, error: "PageSpeed request failed" };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await runPagespeedOnce(url, strategy, apiKey);
    if (!last.error) return last;

    const status = "status" in last ? (last as { status?: number }).status : undefined;
    const retryable =
      status != null && isRetryablePsiError(status, last.error);
    if (!retryable || attempt === maxAttempts) break;

    await sleep(1500 * attempt);
  }

  const { status: _status, ...result } = last as PagespeedResult & {
    status?: number;
  };
  return result;
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
            agenticBrowsingScore: result.agenticBrowsingScore,
            agenticBrowsingPassed: result.agenticBrowsingPassed,
            agenticBrowsingTotal: result.agenticBrowsingTotal,
            lcpMs: result.lcpMs,
            cls: result.cls,
            inpMs: result.inpMs,
            fcpMs: result.fcpMs,
            overallCategory: result.overallCategory,
            error: result.error ?? null,
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
        // Brief pause between audits — PSI is sensitive to burst traffic.
        await sleep(750);
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
          agenticBrowsingScore: result.agenticBrowsingScore,
          agenticBrowsingPassed: result.agenticBrowsingPassed,
          agenticBrowsingTotal: result.agenticBrowsingTotal,
          lcpMs: result.lcpMs,
          cls: result.cls,
          inpMs: result.inpMs,
          fcpMs: result.fcpMs,
          overallCategory: result.overallCategory,
          error: result.error ?? null,
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
      await sleep(750);
    }

    if (errors.length === strategies.length) {
      throw new Error(errors[0] || "PageSpeed sync failed");
    }

    return { ok: true as const, errors };
  },
});
