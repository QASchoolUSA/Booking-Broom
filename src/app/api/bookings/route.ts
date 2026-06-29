import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "convex/_generated/api";
import { hashApiKey } from "@/lib/api-keys";
import type { CreateBookingPayload } from "@/lib/types";

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ??
  "http://localhost:3000,https://sanfordcleaning.com,https://deltonacleaning.com,https://hainescitycleaning.com,https://celebrationcleaning.com"
)
  .split(",")
  .map((o) => o.trim());

function corsHeaders(origin: string | null) {
  const allowed =
    origin &&
    ALLOWED_ORIGINS.some(
      (o) => origin === o || origin.endsWith(o.replace("https://", "."))
    )
      ? origin
      : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");

  try {
    const body = (await request.json()) as CreateBookingPayload;

    if (!body.site_slug || !body.api_key || !body.customer_name) {
      return NextResponse.json(
        { error: "site_slug, api_key, and customer_name are required" },
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
    const result = await client.mutation(api.bookings.createPublic, {
      siteSlug: body.site_slug,
      apiKeyHash: hashApiKey(body.api_key),
      customerName: body.customer_name,
      email: body.email,
      phone: body.phone,
      address: body.address,
      serviceType: body.service_type,
      preferredDate: body.preferred_date,
      preferredTime: body.preferred_time,
      notes: body.notes,
    });

    return NextResponse.json(
      { id: result.id, message: "Booking created" },
      { status: 201, headers: corsHeaders(origin) }
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
