#!/usr/bin/env node
/**
 * Set APNs Convex env from a local .p8 Auth Key.
 *
 * Usage:
 *   node scripts/set-apns-env.mjs /path/to/AuthKey_XXXXXXXXXX.p8
 *
 * Optional env overrides:
 *   APNS_TEAM_ID (default 6MM44B6ZYT)
 *   APNS_BUNDLE_ID (default com.kedrik.bookingbroom)
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { spawnSync } from "node:child_process";

const keyPath = process.argv[2];
if (!keyPath) {
  console.error(
    "Usage: node scripts/set-apns-env.mjs /path/to/AuthKey_XXXXXXXXXX.p8"
  );
  process.exit(1);
}

const match = basename(keyPath).match(/^AuthKey_([A-Z0-9]+)\.p8$/i);
const keyId = process.env.APNS_KEY_ID || match?.[1];
const teamId = process.env.APNS_TEAM_ID || "6MM44B6ZYT";
const bundleId = process.env.APNS_BUNDLE_ID || "com.kedrik.bookingbroom";
const authKey = readFileSync(keyPath, "utf8").trim();

if (!keyId) {
  console.error("Could not parse Key ID from filename; set APNS_KEY_ID.");
  process.exit(1);
}
if (!authKey.includes("BEGIN PRIVATE KEY")) {
  console.error("File does not look like an APNs .p8 private key.");
  process.exit(1);
}

function setEnv(name, value) {
  const args =
    name === "APNS_AUTH_KEY"
      ? ["exec", "convex", "env", "set", name, "--from-file", keyPath]
      : ["exec", "convex", "env", "set", name, value];
  const result = spawnSync("pnpm", args, {
    stdio: "inherit",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Setting APNS_KEY_ID=${keyId}`);
setEnv("APNS_KEY_ID", keyId);
console.log(`Setting APNS_TEAM_ID=${teamId}`);
setEnv("APNS_TEAM_ID", teamId);
console.log(`Setting APNS_BUNDLE_ID=${bundleId}`);
setEnv("APNS_BUNDLE_ID", bundleId);
console.log("Setting APNS_AUTH_KEY=(from .p8)");
setEnv("APNS_AUTH_KEY", authKey);
console.log("Done.");
