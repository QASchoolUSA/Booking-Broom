import { NextResponse } from "next/server";
import { sendSiteTestEmail } from "@/lib/email";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const siteSlug =
    body &&
    typeof body === "object" &&
    "site_slug" in body &&
    typeof (body as { site_slug: unknown }).site_slug === "string"
      ? (body as { site_slug: string }).site_slug.trim()
      : "";

  if (!siteSlug) {
    return NextResponse.json(
      { error: "site_slug is required" },
      { status: 400 }
    );
  }

  const result = await sendSiteTestEmail(siteSlug);
  if (!result.sent) {
    return NextResponse.json(
      { error: result.error ?? "Failed to send test email", to: result.to },
      { status: result.error?.includes("SMTP is not configured") ? 503 : 400 }
    );
  }

  return NextResponse.json({ ok: true, to: result.to });
}
