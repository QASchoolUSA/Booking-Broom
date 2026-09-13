"use node";

import http2 from "node:http2";
import { importPKCS8, SignJWT, type KeyLike } from "jose";

export type ApnsEnvironment = "development" | "production";

export type ApnsSendResult =
  | { ok: true }
  | { ok: false; status: number; reason: string; stale: boolean };

type ApnsConfig = {
  keyId: string;
  teamId: string;
  bundleId: string;
  authKey: string;
};

let cachedJwt: { token: string; expiresAtMs: number } | null = null;
let cachedKey: KeyLike | null = null;
let cachedKeyFingerprint: string | null = null;

export function readApnsConfig(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const authKey = process.env.APNS_AUTH_KEY?.trim();
  const bundleId =
    process.env.APNS_BUNDLE_ID?.trim() || "com.kedrik.bookingbroom";
  if (!keyId || !teamId || !authKey) return null;
  return { keyId, teamId, bundleId, authKey };
}

function apnsHost(environment: ApnsEnvironment): string {
  return environment === "development"
    ? "api.sandbox.push.apple.com"
    : "api.push.apple.com";
}

async function getApnsJwt(config: ApnsConfig): Promise<string> {
  const now = Date.now();
  if (cachedJwt && cachedJwt.expiresAtMs > now + 60_000) {
    return cachedJwt.token;
  }

  const fingerprint = `${config.keyId}:${config.authKey.length}`;
  if (!cachedKey || cachedKeyFingerprint !== fingerprint) {
    cachedKey = await importPKCS8(config.authKey, "ES256");
    cachedKeyFingerprint = fingerprint;
  }

  const iat = Math.floor(now / 1000);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt(iat)
    .sign(cachedKey);

  // APNs JWTs are valid for up to 60 minutes; refresh early.
  cachedJwt = { token, expiresAtMs: now + 50 * 60_000 };
  return token;
}

export async function sendApnsAlert(args: {
  config: ApnsConfig;
  deviceToken: string;
  environment: ApnsEnvironment;
  title: string;
  body: string;
  tag: string;
  url: string;
  mobilePath: string;
  bookingId?: string;
}): Promise<ApnsSendResult> {
  const host = apnsHost(args.environment);
  const jwt = await getApnsJwt(args.config);
  const path = `/3/device/${args.deviceToken}`;
  const payload = JSON.stringify({
    aps: {
      alert: {
        title: args.title,
        body: args.body,
      },
      sound: "default",
      badge: 1,
    },
    url: args.url,
    mobilePath: args.mobilePath,
    tag: args.tag,
    bookingId: args.bookingId,
  });

  return await new Promise<ApnsSendResult>((resolve) => {
    const client = http2.connect(`https://${host}`);
    let settled = false;

    const finish = (result: ApnsSendResult) => {
      if (settled) return;
      settled = true;
      try {
        client.close();
      } catch {
        // ignore
      }
      resolve(result);
    };

    client.on("error", (err) => {
      finish({
        ok: false,
        status: 0,
        reason: err instanceof Error ? err.message : "apns_connect_error",
        stale: false,
      });
    });

    const req = client.request({
      ":method": "POST",
      ":path": path,
      authorization: `bearer ${jwt}`,
      "apns-topic": args.config.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });

    let status = 0;
    let responseBody = "";

    req.setEncoding("utf8");
    req.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    req.on("data", (chunk) => {
      responseBody += chunk;
    });
    req.on("end", () => {
      if (status === 200) {
        finish({ ok: true });
        return;
      }
      let reason = responseBody.slice(0, 200) || `http_${status}`;
      try {
        const parsed = JSON.parse(responseBody) as { reason?: string };
        if (parsed.reason) reason = parsed.reason;
      } catch {
        // keep raw body
      }
      const stale =
        reason === "BadDeviceToken" ||
        reason === "Unregistered" ||
        reason === "ExpiredToken" ||
        status === 410;
      finish({ ok: false, status, reason, stale });
    });
    req.on("error", (err) => {
      finish({
        ok: false,
        status: 0,
        reason: err instanceof Error ? err.message : "apns_request_error",
        stale: false,
      });
    });

    req.end(payload);
  });
}
