/**
 * Voip.ms REST API client (JSON).
 * Docs: https://voip.ms/m/apidocs.php
 */

const API_URL = "https://voip.ms/api/v1/rest.php";

export type VoipmsDid = {
  did: string;
  description: string;
  subAccount?: string;
  smsAvailable: boolean;
  smsEnabled: boolean;
  smsUrlCallback?: string;
  smsUrlCallbackEnabled: boolean;
};

export type VoipmsSmsRow = {
  id: string;
  date: string;
  type: "0" | "1" | string;
  did: string;
  contact: string;
  message: string;
};

export type VoipmsMmsRow = VoipmsSmsRow & {
  col_media1?: string;
  col_media2?: string;
  col_media3?: string;
  media1?: string;
  media2?: string;
  media3?: string;
};

type VoipmsEnvelope = {
  status: string;
  [key: string]: unknown;
};

function requireCreds(): { username: string; password: string } {
  const username = process.env.VOIPMS_API_USERNAME?.trim();
  const password = process.env.VOIPMS_API_PASSWORD?.trim();
  if (!username || !password) {
    throw new Error(
      "Voip.ms API credentials missing. Set VOIPMS_API_USERNAME and VOIPMS_API_PASSWORD in Convex env."
    );
  }
  return { username, password };
}

export async function voipmsCall(
  method: string,
  params: Record<string, string | number | undefined> = {}
): Promise<VoipmsEnvelope> {
  const { username, password } = requireCreds();
  const url = new URL(API_URL);
  url.searchParams.set("api_username", username);
  url.searchParams.set("api_password", password);
  url.searchParams.set("method", method);
  url.searchParams.set("content_type", "json");
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) {
    throw new Error(`Voip.ms HTTP ${res.status}`);
  }
  const data = (await res.json()) as VoipmsEnvelope;
  if (data.status !== "success") {
    throw new Error(`Voip.ms ${method} failed: ${data.status}`);
  }
  return data;
}

function asArray<T>(value: unknown): T[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value as T[];
  return [value as T];
}

function truthyFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "1" || v === "yes" || v === "true";
  }
  return false;
}

function mapDid(
  raw: Record<string, unknown>,
  subAccount?: string
): VoipmsDid | null {
  const did = String(raw.did ?? "").replace(/\D/g, "");
  if (did.length < 10) return null;
  const normalized =
    did.length === 11 && did.startsWith("1") ? did.slice(1) : did;
  if (normalized.length !== 10) return null;

  return {
    did: normalized,
    description: String(raw.description ?? "").trim(),
    subAccount: subAccount || undefined,
    smsAvailable: truthyFlag(raw.sms_available),
    smsEnabled: truthyFlag(raw.sms_enabled),
    smsUrlCallback:
      typeof raw.sms_url_callback === "string"
        ? raw.sms_url_callback
        : undefined,
    smsUrlCallbackEnabled: truthyFlag(raw.sms_url_callback_enabled),
  };
}

/** List sub-account usernames (e.g. 100001_sanford). */
export async function listSubAccounts(): Promise<string[]> {
  try {
    const data = await voipmsCall("getSubAccounts");
    const accounts = asArray<Record<string, unknown>>(data.accounts);
    return accounts
      .map((a) => String(a.account ?? a.username ?? "").trim())
      .filter(Boolean);
  } catch {
    // Some accounts have no sub-accounts; treat as empty.
    return [];
  }
}

/** Sync all DIDs, associating each with its Voip.ms sub-account when possible. */
export async function listDids(): Promise<VoipmsDid[]> {
  const byDid = new Map<string, VoipmsDid>();

  const merge = (did: VoipmsDid) => {
    const existing = byDid.get(did.did);
    if (!existing) {
      byDid.set(did.did, did);
      return;
    }
    byDid.set(did.did, {
      ...existing,
      ...did,
      description: did.description || existing.description,
      subAccount: did.subAccount || existing.subAccount,
    });
  };

  const subAccounts = await listSubAccounts();
  for (const account of subAccounts) {
    try {
      const data = await voipmsCall("getDIDsInfo", { client: account });
      for (const raw of asArray<Record<string, unknown>>(data.dids)) {
        const did = mapDid(raw, account);
        if (did) merge(did);
      }
    } catch {
      // Sub-account may have no DIDs.
    }
  }

  // Main-account DIDs (not assigned to a sub-account, or backup if getSubAccounts empty).
  try {
    const data = await voipmsCall("getDIDsInfo");
    for (const raw of asArray<Record<string, unknown>>(data.dids)) {
      const did = mapDid(raw);
      if (did) merge(did);
    }
  } catch (e) {
    if (byDid.size === 0) throw e;
  }

  return [...byDid.values()].sort((a, b) =>
    (a.description || a.did).localeCompare(b.description || b.did)
  );
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Fetch SMS history. `from`/`to` are YYYY-MM-DD (Voip.ms date range). */
export async function getSms(opts: {
  did?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<VoipmsSmsRow[]> {
  const data = await voipmsCall("getSMS", {
    did: opts.did,
    from: opts.from,
    to: opts.to,
    limit: opts.limit ?? 100,
    timezone: -5,
  });
  return asArray<VoipmsSmsRow>(data.sms).map((row) => ({
    ...row,
    id: String(row.id),
    did: String(row.did ?? "").replace(/\D/g, "").slice(-10),
    contact: String(row.contact ?? "").replace(/\D/g, "").slice(-10),
    message: String(row.message ?? ""),
    date: String(row.date ?? ""),
    type: String(row.type ?? ""),
  }));
}

export async function getMms(opts: {
  did?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<VoipmsMmsRow[]> {
  try {
    const data = await voipmsCall("getMMS", {
      did: opts.did,
      from: opts.from,
      to: opts.to,
      limit: opts.limit ?? 100,
      timezone: -5,
    });
    return asArray<VoipmsMmsRow>(data.mms ?? data.sms).map((row) => ({
      ...row,
      id: String(row.id),
      did: String(row.did ?? "").replace(/\D/g, "").slice(-10),
      contact: String(row.contact ?? "").replace(/\D/g, "").slice(-10),
      message: String(row.message ?? ""),
      date: String(row.date ?? ""),
      type: String(row.type ?? ""),
    }));
  } catch {
    return [];
  }
}

export function defaultSyncDateRange(daysBack = 30): {
  from: string;
  to: string;
} {
  const to = new Date();
  const from = new Date(to.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return { from: ymd(from), to: ymd(to) };
}

export async function sendSms(opts: {
  did: string;
  dst: string;
  message: string;
}): Promise<{ smsId: string }> {
  const data = await voipmsCall("sendSMS", {
    did: opts.did,
    dst: opts.dst,
    message: opts.message,
  });
  const smsId = String(data.sms ?? data.mms ?? Date.now());
  return { smsId };
}

/** Configure SMS URL callback for a DID (enables webhook inbound). */
export async function setSmsCallback(opts: {
  did: string;
  callbackUrl: string;
  enable?: boolean;
}): Promise<void> {
  await voipmsCall("setSMS", {
    did: opts.did,
    enable: "1",
    url_callback_enable: opts.enable === false ? "0" : "1",
    url_callback_retry: "1",
    url_callback: opts.callbackUrl,
  });
}

export function extractMmsMediaUrls(row: VoipmsMmsRow): string[] {
  const urls: string[] = [];
  for (const key of [
    "col_media1",
    "col_media2",
    "col_media3",
    "media1",
    "media2",
    "media3",
  ] as const) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      urls.push(...value.split(",").map((u) => u.trim()).filter(Boolean));
    }
  }
  return [...new Set(urls)];
}

/** Parse Voip.ms date string to epoch ms. */
export function parseVoipmsDate(dateStr: string): number {
  const trimmed = dateStr.trim();
  if (!trimmed) return Date.now();
  // "YYYY-MM-DD HH:mm:ss" — treat as local US Eastern-ish; Date.parse is fine enough.
  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T");
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? Date.now() : ms;
}

/** Voip.ms type: 1 = inbound, 0 = outbound. */
export function directionFromType(type: string): "in" | "out" {
  return String(type) === "1" ? "in" : "out";
}

export function webhookCallbackBaseUrl(): string | null {
  const site =
    process.env.CONVEX_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL?.trim();
  if (!site) return null;
  return site.replace(/\/$/, "");
}

export function buildWebhookUrl(): string | null {
  const base = webhookCallbackBaseUrl();
  const secret = process.env.VOIPMS_WEBHOOK_SECRET?.trim();
  if (!base || !secret) return null;
  return `${base}/voipms/sms?secret=${encodeURIComponent(secret)}&to={TO}&from={FROM}&message={MESSAGE}&id={ID}&date={TIMESTAMP}&media={MEDIA}`;
}
