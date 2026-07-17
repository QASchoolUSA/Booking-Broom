/**
 * Generates JWT keys for @convex-dev/auth and sets Convex env vars.
 * Run: node scripts/setup-convex-auth.mjs [site-url]
 * Production: node scripts/setup-convex-auth.mjs https://bookings.kedrik.com
 */
import { execSync } from "child_process";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const siteUrl = process.argv[2] ?? "http://localhost:3000";

async function setEnv(name, value) {
  const escaped = value.replace(/"/g, '\\"');
  execSync(`pnpm exec convex env set -- ${name} "${escaped}"`, {
    stdio: "inherit",
    cwd: new URL("..", import.meta.url).pathname,
  });
}

async function main() {
  const keys = await generateKeyPair("RS256", { extractable: true });
  const privateKey = await exportPKCS8(keys.privateKey);
  const publicKey = await exportJWK(keys.publicKey);
  const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });
  const jwtPrivateKey = privateKey.trimEnd().replace(/\n/g, " ");

  console.log("Setting JWT_PRIVATE_KEY...");
  await setEnv("JWT_PRIVATE_KEY", jwtPrivateKey);

  console.log("Setting JWKS...");
  await setEnv("JWKS", jwks);

  console.log(`Setting SITE_URL to ${siteUrl}...`);
  await setEnv("SITE_URL", siteUrl);

  console.log("Done. Auth should work now.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
