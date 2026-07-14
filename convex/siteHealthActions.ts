import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { extractPhoneFromHtml } from "./lib/phone";

const BODY_CAP = 512_000;
const FETCH_TIMEOUT_MS = 15_000;

type HealthCheckResult = {
  status: "online" | "offline";
  checkedUrl: string;
  httpStatus?: number;
  error?: string;
  phoneNumber?: string | null;
};

function siteUrl(domain: string): string {
  return `https://${domain.replace(/^https?:\/\//i, "").replace(/\/$/, "")}`;
}

async function checkSiteHealth(
  domain: string,
  siteName: string
): Promise<HealthCheckResult> {
  const checkedUrl = siteUrl(domain);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(checkedUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "BookingBroom-SiteHealth/1.0",
      },
    });

    const httpStatus = res.status;
    const raw = await res.text();
    const body = raw.length > BODY_CAP ? raw.slice(0, BODY_CAP) : raw;
    const phoneNumber = extractPhoneFromHtml(body);
    const needle = siteName.trim().toLowerCase();
    const hasName = needle.length > 0 && body.toLowerCase().includes(needle);

    if (res.ok && hasName) {
      return {
        status: "online",
        checkedUrl,
        httpStatus,
        phoneNumber: phoneNumber ?? null,
      };
    }

    const reasons: string[] = [];
    if (!res.ok) reasons.push(`HTTP ${httpStatus}`);
    if (!hasName) {
      reasons.push(`page does not contain "${siteName}"`);
    }

    return {
      status: "offline",
      checkedUrl,
      httpStatus,
      error: reasons.join("; "),
      phoneNumber: phoneNumber ?? null,
    };
  } catch (e) {
    const message =
      e instanceof Error
        ? e.name === "AbortError"
          ? `Timed out after ${FETCH_TIMEOUT_MS / 1000}s`
          : e.message
        : "Health check failed";
    return {
      status: "offline",
      checkedUrl,
      error: message,
      phoneNumber: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export const checkAllInternal = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    ok: boolean;
    error: string | null;
    sites: number;
  }> => {
    const sites: Array<{
      _id: Id<"sites">;
      domain: string;
      slug: string;
      name: string;
    }> = await ctx.runQuery(internal.siteHealth.listSitesInternal, {});

    const errors: string[] = [];

    for (const site of sites) {
      try {
        const result = await checkSiteHealth(site.domain, site.name);
        await ctx.runMutation(internal.siteHealth.upsertStatus, {
          siteId: site._id,
          status: result.status,
          checkedUrl: result.checkedUrl,
          httpStatus: result.httpStatus,
          error: result.error ?? null,
        });
        if (result.phoneNumber) {
          await ctx.runMutation(internal.sites.setPhoneNumber, {
            siteId: site._id,
            phoneNumber: result.phoneNumber,
          });
        }
        if (result.status === "offline") {
          errors.push(`${site.slug}: ${result.error ?? "offline"}`);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Health check failed";
        errors.push(`${site.slug}: ${message}`);
        await ctx.runMutation(internal.siteHealth.upsertStatus, {
          siteId: site._id,
          status: "offline",
          checkedUrl: siteUrl(site.domain),
          error: message,
        });
      }
    }

    const summary =
      errors.length > 0
        ? errors.slice(0, 5).join("; ") +
          (errors.length > 5 ? ` (+${errors.length - 5} more)` : "")
        : null;

    await ctx.runMutation(internal.siteHealth.setSyncResult, {
      error: summary,
    });

    return {
      ok: errors.length === 0,
      error: summary,
      sites: sites.length,
    };
  },
});

export const checkNow = action({
  args: {},
  handler: async (
    ctx
  ): Promise<{ ok: boolean; error: string | null; sites: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await ctx.runAction(internal.siteHealthActions.checkAllInternal, {});
  },
});

export const checkSite = action({
  args: { siteId: v.id("sites") },
  handler: async (
    ctx,
    args
  ): Promise<{
    ok: true;
    status: "online" | "offline";
    error: string | null;
    phone_number: string | null;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const site = await ctx.runQuery(internal.siteHealth.getSiteInternal, {
      siteId: args.siteId,
    });
    if (!site) throw new Error("Site not found");

    const result = await checkSiteHealth(site.domain, site.name);
    await ctx.runMutation(internal.siteHealth.upsertStatus, {
      siteId: site._id,
      status: result.status,
      checkedUrl: result.checkedUrl,
      httpStatus: result.httpStatus,
      error: result.error ?? null,
    });
    if (result.phoneNumber) {
      await ctx.runMutation(internal.sites.setPhoneNumber, {
        siteId: site._id,
        phoneNumber: result.phoneNumber,
      });
    }

    return {
      ok: true as const,
      status: result.status,
      error: result.error ?? null,
      phone_number: result.phoneNumber ?? null,
    };
  },
});
