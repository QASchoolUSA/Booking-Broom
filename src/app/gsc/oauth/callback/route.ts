import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "convex/_generated/api";

const FALLBACK_ORIGIN = "https://bookings.kedrik.com";

function seoRedirect(origin: string, params: Record<string, string>) {
  const url = new URL("/seo", origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || FALLBACK_ORIGIN;

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  // If Convex Auth previously stripped `code` but left `state`, surface a clear error.
  if (!code && state && !oauthError) {
    return seoRedirect(appOrigin, {
      gsc: "error",
      message:
        "OAuth code was missing (auth middleware may have intercepted it). Try Connect again.",
    });
  }

  if (oauthError) {
    return seoRedirect(appOrigin, {
      gsc: "error",
      message:
        oauthError === "access_denied"
          ? "Google authorization was denied"
          : oauthError,
    });
  }

  if (!code || !state) {
    return seoRedirect(appOrigin, {
      gsc: "error",
      message: "Missing OAuth code or state",
    });
  }

  if (!convexUrl) {
    return seoRedirect(appOrigin, {
      gsc: "error",
      message: "NEXT_PUBLIC_CONVEX_URL is not configured",
    });
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const result = await client.action(api.gscActions.completeOAuthCallback, {
      code,
      state,
    });

    if (!result.ok) {
      return seoRedirect(result.returnOrigin || appOrigin, {
        gsc: "error",
        message: result.error || "OAuth failed",
      });
    }

    return seoRedirect(result.returnOrigin, { gsc: "connected" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "OAuth callback failed";
    return seoRedirect(appOrigin, { gsc: "error", message });
  }
}
