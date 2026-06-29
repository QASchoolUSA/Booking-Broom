import { createHash } from "crypto";

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

export function getDevApiKey(slug: string): string {
  return `bb_${slug}_dev_key`;
}
