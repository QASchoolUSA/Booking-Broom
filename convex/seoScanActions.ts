import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const BODY_CAP = 512_000;
const FETCH_TIMEOUT_MS = 15_000;

type ScanCheck = {
  id: string;
  label: string;
  pass: boolean;
  detail?: string;
};

function siteUrl(domain: string): string {
  return `https://${domain.replace(/^https?:\/\//i, "").replace(/\/$/, "")}`;
}

function metaContent(html: string, nameOrProp: string): string | null {
  const escaped = nameOrProp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["']`,
      "i"
    ),
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1] != null) return m[1].trim();
  }
  return null;
}

function extractTitle(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!m) return null;
  return m[1].replace(/\s+/g, " ").trim() || null;
}

function countH1(html: string): number {
  const matches = html.match(/<h1\b[^>]*>/gi);
  return matches?.length ?? 0;
}

function extractCanonical(html: string): string | null {
  const m =
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html) ||
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i.exec(html);
  return m?.[1]?.trim() || null;
}

function hasJsonLd(html: string): boolean {
  return /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
}

function hasMicrodata(html: string): boolean {
  return /\bitemtype\s*=/i.test(html);
}

function analyzeHtml(
  html: string,
  finalUrl: string
): { checks: ScanCheck[]; passed: number; total: number; score: number } {
  const title = extractTitle(html);
  const description = metaContent(html, "description");
  const robots = metaContent(html, "robots")?.toLowerCase() ?? "";
  const ogTitle = metaContent(html, "og:title");
  const ogDescription = metaContent(html, "og:description");
  const h1Count = countH1(html);
  const canonical = extractCanonical(html);
  const schemaOk = hasJsonLd(html) || hasMicrodata(html);

  const titleLen = title?.length ?? 0;
  const descLen = description?.length ?? 0;

  const checks: ScanCheck[] = [
    {
      id: "https",
      label: "HTTPS",
      pass: finalUrl.startsWith("https://"),
      detail: finalUrl,
    },
    {
      id: "title",
      label: "Title tag",
      pass: titleLen >= 30 && titleLen <= 60,
      detail: title
        ? `${titleLen} chars: ${title.slice(0, 80)}`
        : "Missing <title>",
    },
    {
      id: "meta_description",
      label: "Meta description",
      pass: descLen >= 70 && descLen <= 160,
      detail: description
        ? `${descLen} chars`
        : "Missing meta description",
    },
    {
      id: "h1",
      label: "Single H1",
      pass: h1Count === 1,
      detail: `${h1Count} H1 element${h1Count === 1 ? "" : "s"}`,
    },
    {
      id: "canonical",
      label: "Canonical URL",
      pass: Boolean(canonical && /^https?:\/\//i.test(canonical)),
      detail: canonical ?? "Missing canonical link",
    },
    {
      id: "robots",
      label: "Indexable robots",
      pass: !robots.includes("noindex"),
      detail: robots || "No robots meta (indexable by default)",
    },
    {
      id: "og",
      label: "Open Graph",
      pass: Boolean(ogTitle && ogDescription),
      detail:
        ogTitle && ogDescription
          ? "og:title + og:description present"
          : "Missing og:title or og:description",
    },
    {
      id: "schema",
      label: "Structured data",
      pass: schemaOk,
      detail: schemaOk
        ? hasJsonLd(html)
          ? "JSON-LD found"
          : "Microdata found"
        : "No JSON-LD or Microdata",
    },
  ];

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  const score = Math.round((passed / total) * 100);
  return { checks, passed, total, score };
}

async function fetchHomepage(domain: string): Promise<{
  url: string;
  html: string;
  error?: string;
}> {
  const url = siteUrl(domain);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "BookingBroom-SeoScan/1.0",
      },
    });
    const raw = await res.text();
    const html = raw.length > BODY_CAP ? raw.slice(0, BODY_CAP) : raw;
    const finalUrl = res.url || url;

    if (!res.ok) {
      return {
        url: finalUrl,
        html,
        error: `HTTP ${res.status}`,
      };
    }
    return { url: finalUrl, html };
  } catch (e) {
    const message =
      e instanceof Error
        ? e.name === "AbortError"
          ? `Timed out after ${FETCH_TIMEOUT_MS / 1000}s`
          : e.message
        : "Fetch failed";
    return { url, html: "", error: message };
  } finally {
    clearTimeout(timer);
  }
}

async function scanOneSite(
  ctx: {
    runMutation: (
      ref: typeof internal.seoScan.upsertScan,
      args: {
        siteId: Id<"sites">;
        scannedUrl: string;
        score: number;
        passed: number;
        total: number;
        checks: ScanCheck[];
        error?: string | null;
      }
    ) => Promise<unknown>;
  },
  site: { _id: Id<"sites">; domain: string }
) {
  const fetched = await fetchHomepage(site.domain);

  if (fetched.error && !fetched.html) {
    await ctx.runMutation(internal.seoScan.upsertScan, {
      siteId: site._id,
      scannedUrl: fetched.url,
      score: 0,
      passed: 0,
      total: 8,
      checks: [
        {
          id: "fetch",
          label: "Fetch homepage",
          pass: false,
          detail: fetched.error,
        },
      ],
      error: fetched.error,
    });
    return { ok: false as const, error: fetched.error };
  }

  const analysis = analyzeHtml(fetched.html, fetched.url);
  if (fetched.error) {
    analysis.checks.unshift({
      id: "fetch",
      label: "Fetch homepage",
      pass: false,
      detail: fetched.error,
    });
  }

  const passed = analysis.checks.filter((c) => c.pass).length;
  const total = analysis.checks.length;
  const score = Math.round((passed / total) * 100);

  await ctx.runMutation(internal.seoScan.upsertScan, {
    siteId: site._id,
    scannedUrl: fetched.url,
    score,
    passed,
    total,
    checks: analysis.checks,
    error: fetched.error ?? null,
  });

  return { ok: true as const, score };
}

export const scanSite = action({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const site = await ctx.runQuery(internal.seoScan.getSiteInternal, {
      siteId: args.siteId,
    });
    if (!site) throw new Error("Site not found");

    const result = await scanOneSite(ctx, site);
    if (!result.ok) {
      throw new Error(result.error || "Page scan failed");
    }
    return { ok: true, score: result.score };
  },
});

export const scanAll = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const sites = await ctx.runQuery(internal.seoScan.listSitesInternal, {});
    let ok = 0;
    const errors: string[] = [];

    for (const site of sites) {
      const result = await scanOneSite(ctx, site);
      if (result.ok) ok += 1;
      else errors.push(`${site.slug}: ${result.error}`);
    }

    return {
      sites: ok,
      error: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
    };
  },
});

export const scanAllInternal = internalAction({
  args: {},
  handler: async (ctx) => {
    const sites = await ctx.runQuery(internal.seoScan.listSitesInternal, {});
    for (const site of sites) {
      await scanOneSite(ctx, site);
    }
    return { ok: true as const };
  },
});
