"use node";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function getKey(): Buffer {
  const raw = process.env.EMAIL_CREDENTIALS_KEY;
  if (!raw) {
    throw new Error(
      "EMAIL_CREDENTIALS_KEY is not set in Convex env (32-byte secret, base64 or hex)"
    );
  }
  // Accept base64 (44 chars with padding) or 64-char hex, or raw 32-byte utf8.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  try {
    const b64 = Buffer.from(raw, "base64");
    if (b64.length === 32) return b64;
  } catch {
    // fall through
  }
  const utf = Buffer.from(raw, "utf8");
  if (utf.length === 32) return utf;
  throw new Error(
    "EMAIL_CREDENTIALS_KEY must be 32 bytes (hex, base64, or utf8)"
  );
}

export function encryptPassword(plaintext: string): {
  ciphertext: string;
  iv: string;
} {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // ciphertext = enc || tag (auth tag appended)
  return {
    ciphertext: Buffer.concat([enc, tag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptPassword(ciphertext: string, iv: string): string {
  const key = getKey();
  const data = Buffer.from(ciphertext, "base64");
  const ivBuf = Buffer.from(iv, "base64");
  if (data.length < 17) throw new Error("Invalid ciphertext");
  const tag = data.subarray(data.length - 16);
  const enc = data.subarray(0, data.length - 16);
  const decipher = createDecipheriv(ALGO, key, ivBuf);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    "utf8"
  );
}
