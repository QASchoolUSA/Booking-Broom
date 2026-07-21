import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { normalizeUsDigits } from "./lib/phone";
import { parseVoipmsDate } from "./lib/voipms";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * Voip.ms SMS/MMS URL callback.
 * Configure in portal (or via setSMS) as:
 *   {CONVEX_SITE_URL}/voipms/sms?secret=...&to={TO}&from={FROM}&message={MESSAGE}&id={ID}&date={TIMESTAMP}&media={MEDIA}
 * Responds with plain "ok" for URL Callback Retry.
 */
const voipmsSmsWebhook = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const secret = process.env.VOIPMS_WEBHOOK_SECRET?.trim();
  const provided =
    url.searchParams.get("secret") ?? url.searchParams.get("api_key");

  if (!secret || provided !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  const toRaw =
    url.searchParams.get("to") ?? url.searchParams.get("TO") ?? "";
  const fromRaw =
    url.searchParams.get("from") ?? url.searchParams.get("FROM") ?? "";
  const message =
    url.searchParams.get("message") ??
    url.searchParams.get("MESSAGE") ??
    "";
  const id =
    url.searchParams.get("id") ??
    url.searchParams.get("ID") ??
    `${Date.now()}`;
  const date =
    url.searchParams.get("date") ??
    url.searchParams.get("TIMESTAMP") ??
    url.searchParams.get("timestamp") ??
    "";
  const mediaRaw =
    url.searchParams.get("media") ??
    url.searchParams.get("MEDIA") ??
    url.searchParams.get("files") ??
    "";

  const did = normalizeUsDigits(toRaw);
  const contact = normalizeUsDigits(fromRaw);
  if (!did || !contact) {
    // Still ack so Voip.ms stops retrying bad payloads.
    return new Response("ok", { status: 200 });
  }

  const mediaUrls = mediaRaw
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u.length > 0 && u !== "{MEDIA}");

  await ctx.runMutation(internal.sms.upsertMessageInternal, {
    voipmsId: String(id),
    did,
    contact,
    direction: "in",
    type: mediaUrls.length > 0 ? "mms" : "sms",
    body: message,
    mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
    sentAt: parseVoipmsDate(date),
  });

  return new Response("ok", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
});

http.route({
  path: "/voipms/sms",
  method: "GET",
  handler: voipmsSmsWebhook,
});

http.route({
  path: "/voipms/sms",
  method: "POST",
  handler: voipmsSmsWebhook,
});

export default http;
