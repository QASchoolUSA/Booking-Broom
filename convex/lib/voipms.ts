/**
 * Voip.ms REST API client (JSON).
 * Docs: https://voip.ms/m/apidocs.php
 */

import { smsPartyDigits } from "./phone";

const API_URL = "https://voip.ms/api/v1/rest.php";

/** Single-segment SMS body limit (Voip.ms sendSMS). */
export const SMS_SEGMENT_MAX = 160;
/** Text-only MMS body limit (Voip.ms sendMMS). */
export const MMS_TEXT_MAX = 2048;

export type VoipmsDid = {
  did: string;
  /** Voip.ms "Note" / description (often location-ish). */
  description: string;
  /** Voip.ms "Caller ID name prefix" — the label users set per DID. */
  calleridPrefix: string;
  note: string;
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
  params: Record<string, string | number | undefined> = {},
  opts?: { httpMethod?: "GET" | "POST" }
): Promise<VoipmsEnvelope> {
  const { username, password } = requireCreds();
  const httpMethod = opts?.httpMethod ?? "GET";

  let res: Response;
  if (httpMethod === "POST") {
    const body = new URLSearchParams();
    body.set("api_username", username);
    body.set("api_password", password);
    body.set("method", method);
    body.set("content_type", "json");
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === "") continue;
      body.set(key, String(value));
    }
    res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } else {
    const url = new URL(API_URL);
    url.searchParams.set("api_username", username);
    url.searchParams.set("api_password", password);
    url.searchParams.set("method", method);
    url.searchParams.set("content_type", "json");
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === "") continue;
      url.searchParams.set(key, String(value));
    }
    res = await fetch(url.toString(), { method: "GET" });
  }

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
    calleridPrefix: String(
      raw.callerid_prefix ?? raw.calleridprefix ?? ""
    ).trim(),
    note: String(raw.note ?? "").trim(),
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

/** Strip Voip.ms account id prefix, e.g. 100001_sanford → sanford. */
export function cleanSubAccountLabel(subAccount: string | undefined): string {
  if (!subAccount?.trim()) return "";
  const raw = subAccount.trim();
  const withoutId = raw.replace(/^\d+_/, "");
  return (withoutId || raw).trim();
}

function isJustDidDigits(label: string, did?: string): boolean {
  const digits = (did ?? "").replace(/\D/g, "").slice(-10);
  if (!label.trim() || !digits) return false;
  return label.replace(/\D/g, "") === digits;
}

/**
 * Label to store/display for a DID.
 * Prefers Caller ID Prefix (portal "Caller ID name prefix"), then note,
 * then description, then cleaned sub-account. Never the raw phone digits.
 */
export function resolveDidLabel(opts: {
  calleridPrefix?: string;
  note?: string;
  description?: string;
  subAccount?: string;
  did?: string;
}): string {
  const candidates = [
    opts.calleridPrefix?.trim() ?? "",
    opts.note?.trim() ?? "",
    opts.description?.trim() ?? "",
  ];
  for (const label of candidates) {
    if (label && !isJustDidDigits(label, opts.did)) return label;
  }
  return cleanSubAccountLabel(opts.subAccount);
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
      calleridPrefix: did.calleridPrefix || existing.calleridPrefix,
      note: did.note || existing.note,
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

/** Voip.ms caps each getSMS/getMMS response around this size. */
export const VOIPMS_PAGE_LIMIT = 100;

/** Default full-history lookback for Sync (covers typical Voip.ms retention). */
export const VOIPMS_FULL_HISTORY_DAYS = 365;

/** Overlap when refreshing after a prior full sync (catch late webhooks). */
export const VOIPMS_RECENT_OVERLAP_DAYS = 3;

export function parseYmd(ymdStr: string): Date {
  const [y, m, d] = ymdStr.split("-").map((n) => Number(n));
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
}

export function addDaysYmd(ymdStr: string, days: number): string {
  const d = parseYmd(ymdStr);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
}

export function midYmd(from: string, to: string): string {
  const a = parseYmd(from).getTime();
  const b = parseYmd(to).getTime();
  return ymd(new Date(Math.floor((a + b) / 2)));
}

/** Inclusive date windows of up to `chunkDays` covering [from, to]. */
export function chunkDateRange(
  from: string,
  to: string,
  chunkDays: number
): Array<{ from: string; to: string }> {
  if (from > to) return [];
  const chunks: Array<{ from: string; to: string }> = [];
  let cursor = from;
  while (cursor <= to) {
    const end = addDaysYmd(cursor, Math.max(0, chunkDays - 1));
    const clipped = end < to ? end : to;
    chunks.push({ from: cursor, to: clipped });
    cursor = addDaysYmd(clipped, 1);
  }
  return chunks;
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
    limit: opts.limit ?? VOIPMS_PAGE_LIMIT,
    timezone: -5,
  });
  return asArray<VoipmsSmsRow>(data.sms).map((row) => ({
    ...row,
    id: String(row.id),
    did: smsPartyDigits(String(row.did ?? "")) ?? "",
    contact: smsPartyDigits(String(row.contact ?? "")) ?? "",
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
      limit: opts.limit ?? VOIPMS_PAGE_LIMIT,
      timezone: -5,
    });
    return asArray<VoipmsMmsRow>(data.mms ?? data.sms).map((row) => ({
      ...row,
      id: String(row.id),
      did: smsPartyDigits(String(row.did ?? "")) ?? "",
      contact: smsPartyDigits(String(row.contact ?? "")) ?? "",
      message: String(row.message ?? ""),
      date: String(row.date ?? ""),
      type: String(row.type ?? ""),
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch every SMS in [from, to], recursively splitting windows when Voip.ms
 * returns a full page (so nothing is silently truncated).
 */
export async function getSmsComplete(opts: {
  did?: string;
  from: string;
  to: string;
}): Promise<VoipmsSmsRow[]> {
  const rows = await getSms({
    did: opts.did,
    from: opts.from,
    to: opts.to,
    limit: VOIPMS_PAGE_LIMIT,
  });
  if (rows.length < VOIPMS_PAGE_LIMIT || opts.from >= opts.to) {
    return rows;
  }
  const mid = midYmd(opts.from, opts.to);
  if (mid <= opts.from || mid >= opts.to) return rows;
  const next = addDaysYmd(mid, 1);
  const [left, right] = await Promise.all([
    getSmsComplete({ did: opts.did, from: opts.from, to: mid }),
    getSmsComplete({ did: opts.did, from: next, to: opts.to }),
  ]);
  const byId = new Map<string, VoipmsSmsRow>();
  for (const row of [...left, ...right]) byId.set(row.id, row);
  return [...byId.values()];
}

/** Same completeness strategy for MMS. */
export async function getMmsComplete(opts: {
  did?: string;
  from: string;
  to: string;
}): Promise<VoipmsMmsRow[]> {
  const rows = await getMms({
    did: opts.did,
    from: opts.from,
    to: opts.to,
    limit: VOIPMS_PAGE_LIMIT,
  });
  if (rows.length < VOIPMS_PAGE_LIMIT || opts.from >= opts.to) {
    return rows;
  }
  const mid = midYmd(opts.from, opts.to);
  if (mid <= opts.from || mid >= opts.to) return rows;
  const next = addDaysYmd(mid, 1);
  const [left, right] = await Promise.all([
    getMmsComplete({ did: opts.did, from: opts.from, to: mid }),
    getMmsComplete({ did: opts.did, from: next, to: opts.to }),
  ]);
  const byId = new Map<string, VoipmsMmsRow>();
  for (const row of [...left, ...right]) byId.set(row.id, row);
  return [...byId.values()];
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

/**
 * Text-only MMS (Voip.ms allows long text without media1–3).
 * Always POST so bodies up to 2048 chars are not truncated by GET URL limits.
 */
export async function sendMms(opts: {
  did: string;
  dst: string;
  message: string;
}): Promise<{ mmsId: string }> {
  const data = await voipmsCall(
    "sendMMS",
    {
      did: opts.did,
      dst: opts.dst,
      message: opts.message,
    },
    { httpMethod: "POST" }
  );
  const mmsId = String(data.mms ?? data.sms ?? Date.now());
  return { mmsId };
}

/** Best-effort delete of one SMS on Voip.ms (by message id). */
export async function deleteSms(id: string): Promise<void> {
  await voipmsCall("deleteSMS", { id });
}

/** Best-effort delete of one MMS on Voip.ms (by message id). */
export async function deleteMms(id: string): Promise<void> {
  await voipmsCall("deleteMMS", { id });
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
