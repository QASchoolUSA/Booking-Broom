import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "convex/_generated/api";
import { hashApiKey } from "@/lib/api-keys";
import { corsHeaders } from "@/lib/cors";
import {
  normalizeAttribution,
  normalizeIntent,
  normalizeProperty,
  normalizeQuote,
} from "@/lib/booking-payload";
import type { CreatePartialLeadPayload } from "@/lib/types";

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");

  try {
    const body = (await request.json()) as CreatePartialLeadPayload;

    if (!body.site_slug || !body.api_key || !body.session_key) {
      return NextResponse.json(
        { error: "site_slug, api_key, and session_key are required" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const hasEmail =
      typeof body.email === "string" &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim());
    const hasPhone =
      typeof body.phone === "string" &&
      body.phone.replace(/\D/g, "").length >= 10;

    if (!hasEmail && !hasPhone) {
      return NextResponse.json(
        { error: "A valid email or phone is required" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    const client = new ConvexHttpClient(convexUrl);
    const result = await client.mutation(api.partialLeads.upsertPublic, {
      siteSlug: body.site_slug,
      apiKeyHash: hashApiKey(body.api_key),
      sessionKey: body.session_key,
      customerName: body.customer_name,
      email: body.email,
      phone: body.phone,
      address: body.address,
      serviceType: body.service_type,
      preferredDate: body.preferred_date,
      preferredTime: body.preferred_time,
      notes: body.notes,
      property: normalizeProperty(body.property),
      quote: normalizeQuote(body.quote),
      attribution: normalizeAttribution(body.attribution),
      intent: normalizeIntent(body.intent),
      lastStep: body.last_step,
    });

    return NextResponse.json(
      { id: result.id, converted: result.converted },
      { status: 200, headers: corsHeaders(origin) }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid request body";
    const status =
      message.includes("Invalid site") ? 404 :
      message.includes("Invalid API key") ? 401 : 400;

    return NextResponse.json(
      { error: message },
      { status, headers: corsHeaders(origin) }
    );
  }
}
