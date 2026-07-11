import { action, internalAction, httpAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { dateRangeForPeriod, matchGscProperty } from "./lib/gscMatch";

const GSC_SCOPE =
  "https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/userinfo.email";

const PERIODS = [7, 28, 90] as const;

function redirectUri(): string {
  const siteUrl = process.env.CONVEX_SITE_URL;
  if (!siteUrl) throw new Error("CONVEX_SITE_URL is not set");
  return `${siteUrl.replace(/\/$/, "")}/gsc/oauth/callback`;
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

export const oauthCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const fallbackOrigin =
    process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

  const failRedirect = (origin: string, message: string) =>
    Response.redirect(
      `${origin}/seo?gsc=error&message=${encodeURIComponent(message)}`,
      302
    );

  if (oauthError) {
    return failRedirect(
      fallbackOrigin,
      oauthError === "access_denied"
        ? "Google authorization was denied"
        : oauthError
    );
  }

  if (!code || !state) {
    return failRedirect(fallbackOrigin, "Missing OAuth code or state");
  }

  const consumed = await ctx.runMutation(internal.gsc.consumeOauthState, {
    state,
  });
  const returnOrigin = consumed?.returnOrigin ?? fallbackOrigin;

  if (!consumed) {
    return failRedirect(returnOrigin, "Invalid or expired OAuth state");
  }

  try {
    const tokens = await exchangeCode(code);
    const email = await fetchGoogleEmail(tokens.accessToken);
    await ctx.runMutation(internal.gsc.upsertConnection, {
      googleEmail: email,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: Date.now() + tokens.expiresIn * 1000,
    });

    await ctx.scheduler.runAfter(0, internal.gscActions.syncAllInternal, {});

    return Response.redirect(`${returnOrigin}/seo?gsc=connected`, 302);
  } catch (e) {
    const message = e instanceof Error ? e.message : "OAuth failed";
    return failRedirect(returnOrigin, message);
  }
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

async function querySearchAnalytics(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<{
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}> {
  const encoded = encodeURIComponent(siteUrl);
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ startDate, endDate }),
    }
  );
  const data = (await res.json()) as {
    rows?: {
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(
      data.error?.message || `Search analytics failed for ${siteUrl}`
    );
  }
  const row = data.rows?.[0];
  if (!row) {
    return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  }
  return {
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  };
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

      const properties = await listGscSites(accessToken);
      const sites = await ctx.runQuery(internal.gsc.listSitesInternal, {});

      for (const site of sites) {
        const property = matchGscProperty(
          site.domain,
          properties,
          site.gscPropertyUrl
        );
        if (!property) continue;

        for (const periodDays of PERIODS) {
          const { startDate, endDate } = dateRangeForPeriod(periodDays);
          const stats = await querySearchAnalytics(
            accessToken,
            property,
            startDate,
            endDate
          );
          await ctx.runMutation(internal.gsc.upsertMetric, {
            siteId: site._id as Id<"sites">,
            periodDays,
            gscPropertyUrl: property,
            clicks: stats.clicks,
            impressions: stats.impressions,
            ctr: stats.ctr,
            position: stats.position,
            startDate,
            endDate,
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
