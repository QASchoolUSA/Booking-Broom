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
  sanitizeEmailProperty,
  sanitizeEmailQuote,
} from "@/lib/booking-payload";
import type { CreateBookingPayload } from "@/lib/types";

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
      property: normalizeProperty(body.property),
      quote: normalizeQuote(body.quote),
      attribution: normalizeAttribution(body.attribution),
      intent: normalizeIntent(body.intent),
    });

    try {
      // Strip unknown fields so site-specific property extras (e.g. Sanford
      // condition/occupants) never fail Convex arg validation and skip email.
      const emailResult = await client.action(
        api.emailActions.sendBookingEmails,
        {
          site_slug: body.site_slug,
          customer_name: body.customer_name,
          email: body.email,
          phone: body.phone,
          address: body.address,
          service_type: body.service_type,
          preferred_date: body.preferred_date,
          preferred_time: body.preferred_time,
          notes: body.notes,
          property: sanitizeEmailProperty(body.property),
          quote: sanitizeEmailQuote(body.quote),
        }
      );
      if (emailResult.errors?.length) {
        console.error("Booking email errors:", emailResult.errors);
      } else if (!emailResult.sent && emailResult.via === "none") {
        console.warn(
          "Booking emails skipped: connect a SpaceMail mailbox for this site, or set SMTP_* in Convex env"
        );
      }
    } catch (error) {
      console.error("Failed to send booking emails:", error);
    }

    try {
      const smsResult = await client.action(api.voipmsActions.sendBookingSms, {
        site_slug: body.site_slug,
        customer_name: body.customer_name,
        phone: body.phone,
        service_type: body.service_type,
        preferred_date: body.preferred_date,
      });
      if (!smsResult.sent && smsResult.skipped) {
        console.warn("Booking SMS skipped:", smsResult.skipped);
      }
    } catch (error) {
      console.error("Failed to send booking SMS:", error);
    }

    // Push is scheduled inside bookings.createPublic (Convex) so it always runs once.

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
