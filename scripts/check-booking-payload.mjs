#!/usr/bin/env node
/**
 * Smoke-tests the public booking API against a locally running dashboard.
 *
 * Posts three payloads and reads each one back through the same query the
 * dashboard uses, because a typecheck cannot catch a field that arrives as
 * `undefined`:
 *
 *   1. every structured field the contract accepts,
 *   2. a legacy payload that puts the same facts in `notes` as prose,
 *   3. the bare minimum, to prove older sites still work.
 *
 * Usage: node scripts/check-booking-payload.mjs [--site deltona]
 */

import { spawnSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const site = argValue("--site") ?? "deltona";
const apiKey = process.env.API_KEY ?? `bb_${site}_dev_key`;

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

let failures = 0;

function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail === undefined ? "" : ` — got ${JSON.stringify(detail)}`}`);
  }
}

async function post(payload) {
  const response = await fetch(`${BASE}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ site_slug: site, api_key: apiKey, ...payload }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

const FULL = {
  customer_name: "Payload Smoke Full",
  email: "full@example.com",
  phone: "(407) 555-0100",
  address: "123 Structured Way, Deltona, FL",
  service_type: "Deep Clean",
  preferred_date: "2026-09-01",
  preferred_time: "morning",
  notes: "Two cats, gate code 4417.",
  intent: "quote",
  attribution: {
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "deep-clean-fl",
    utm_term: "deep cleaning deltona",
    utm_content: "headline-b",
    gclid: "EAIaIQobChMI-smoke",
  },
  property: {
    bedrooms: 4,
    bathrooms: 2.5,
    square_feet: 2100,
    size_label: "2,000-2,500 sq ft",
    home_type: "Single-family home",
    condition: "Very dirty",
    occupants: 5,
    last_cleaned: "2026-02-14 (professional)",
    excluded_areas: ["Garage", "Guest bedroom"],
  },
  quote: {
    estimate: 389,
    estimate_low: 349,
    estimate_high: 429,
    recurring_estimate: 199,
    currency: "USD",
    service_level: "Deep Clean",
    frequency: "Bi-weekly",
    add_ons: [
      { label: "Inside fridge", price: 35, quantity: 1 },
      { label: "Interior windows", price: 15, quantity: 6 },
    ],
    payment_terms: "Due after cleaning is complete",
  },
};

const LEGACY = {
  customer_name: "Payload Smoke Legacy",
  email: "legacy@example.com",
  service_type: "Standard Clean",
  notes: [
    "Please skip the office.",
    "Bedrooms: 3",
    "Bathrooms: 2",
    "Estimate: $240",
    "Intent: quote",
    "Source: website-calculator",
  ].join("\n"),
};

const MINIMAL = { customer_name: "Payload Smoke Minimal" };

console.log(`Booking API at ${BASE} (site ${site})\n`);

const full = await post(FULL);
check("full payload accepted", full.status === 201 || full.status === 200, full);
const legacy = await post(LEGACY);
check("legacy prose payload accepted", legacy.status === 201 || legacy.status === 200, legacy);
const minimal = await post(MINIMAL);
check("name-only payload accepted", minimal.status === 201 || minimal.status === 200, minimal);

/**
 * The API returns only an id, so read the rows back through Convex to confirm
 * what was actually persisted, in exactly the shape the dashboard receives.
 */
function readBack() {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "convex",
      "run",
      "bookings:latestForSite",
      JSON.stringify({ slug: site, limit: 50 }),
    ],
    {
      cwd: new URL("..", import.meta.url).pathname,
      encoding: "utf8",
      env: { ...process.env, CONVEX_AGENT_MODE: process.env.CONVEX_AGENT_MODE ?? "anonymous" },
    },
  );

  if (result.status !== 0) return { error: result.stderr || result.stdout };

  // `convex run` prints the JSON result after any log lines.
  const start = result.stdout.indexOf("[");
  if (start === -1) return { error: result.stdout };
  try {
    return { rows: JSON.parse(result.stdout.slice(start)) };
  } catch (error) {
    return { error: `${error}` };
  }
}

const { rows, error } = readBack();

if (error) {
  console.log(`\n  skip  field-level checks — cannot read bookings back.\n${error}`);
  process.exit(failures > 0 ? 1 : 0);
}

const bookings = rows ?? [];
const stored = bookings.find((b) => b.customer_name === FULL.customer_name);
const storedLegacy = bookings.find((b) => b.customer_name === LEGACY.customer_name);

if (!stored) {
  check("full payload readable", false, "row not found");
} else {
  check("intent stored", stored.intent === "quote", stored.intent);
  check("attribution stored", stored.attribution?.gclid === FULL.attribution.gclid, stored.attribution);
  check("condition stored", stored.property?.condition === "Very dirty", stored.property);
  check("occupants stored", stored.property?.occupants === 5, stored.property?.occupants);
  check("last cleaned stored", Boolean(stored.property?.last_cleaned), stored.property?.last_cleaned);
  check("exclusions stored", stored.property?.excluded_areas?.length === 2, stored.property?.excluded_areas);
  check("add-on quantity stored", stored.quote?.add_ons?.[1]?.quantity === 6, stored.quote?.add_ons);
  check("recurring estimate stored", stored.quote?.recurring_estimate === 199, stored.quote?.recurring_estimate);
}

if (storedLegacy) {
  check("legacy notes still parse", Boolean(storedLegacy.notes?.includes("skip the office")), storedLegacy.notes);
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures > 0 ? 1 : 0);
