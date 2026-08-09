import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "convex/_generated/api";
import { hashApiKey } from "@/lib/api-keys";
import { corsHeaders } from "@/lib/cors";

/**
 * Serves a cleaning site its live pricing numbers.
 *
 * Authenticated with the same slug + API key pair the site already uses to post
 * bookings, passed as headers so keys stay out of URLs, logs and caches.
 */

const CORS_METHODS = "GET, OPTIONS";
const CORS_HEADERS = "Content-Type, X-Site-Slug, X-Api-Key";

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(
      request.headers.get("origin"),
      CORS_METHODS,
      CORS_HEADERS
    ),
  });
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const cors = corsHeaders(origin, CORS_METHODS, CORS_HEADERS);

  const url = new URL(request.url);
  const slug =
    request.headers.get("x-site-slug") ?? url.searchParams.get("site_slug");
  const apiKey = request.headers.get("x-api-key");

  if (!slug || !apiKey) {
    return NextResponse.json(
      { error: "X-Site-Slug and X-Api-Key headers are required" },
      { status: 400, headers: cors }
    );
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500, headers: cors }
    );
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const pricing = await client.query(api.pricing.getForSite, {
      slug,
      apiKeyHash: hashApiKey(apiKey),
    });

    const etag = `"${slug}-v${pricing.version}"`;
    const cacheHeaders = {
      ...cors,
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      ETag: etag,
      Vary: "Origin, X-Site-Slug",
    };

    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: cacheHeaders });
    }

    return NextResponse.json(pricing, { status: 200, headers: cacheHeaders });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load pricing";
    const status = message.includes("Invalid site")
      ? 404
      : message.includes("Invalid API key")
        ? 401
        : message.includes("No pricing configured")
          ? 404
          : 500;

    return NextResponse.json(
      { error: message },
      { status, headers: cors }
    );
  }
}
