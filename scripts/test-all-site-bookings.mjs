#!/usr/bin/env node
/**
 * Probe every live cleaning site's booking API (the public proxy), not Booking
 * Broom directly. A pass means that Worker has credentials and forwarded a row.
 *
 * Uses phone 3212360618 so Booking Broom skips customer SMS.
 * Each pass still creates a real dashboard booking and may send emails.
 *
 * Usage:
 *   pnpm test:bookings-all
 *   BOOKING_TEST_EMAIL=you@example.com pnpm test:bookings-all
 *   pnpm test:bookings-all -- --site=haines-city
 */

/** Owner test DID — Booking Broom skips customer confirmation SMS for this number. */
const SKIP_SMS_PHONE = "3212360618";
const TEST_EMAIL =
  process.env.BOOKING_TEST_EMAIL?.trim() || "booking-test@kedrik.com";
const CUSTOMER_NAME = "BB Probe Test";

function digitsOnly(value) {
  if (typeof value !== "string") return "";
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits;
}

function phoneFromPayload(body) {
  if (!body || typeof body !== "object") return "";
  return (
    body.phone ||
    body.bookingData?.phone ||
    body.customer?.phone ||
    ""
  );
}

function assertSkipSmsPhone(body, slug) {
  const digits = digitsOnly(phoneFromPayload(body));
  if (digits !== SKIP_SMS_PHONE) {
    throw new Error(
      `${slug}: probe phone must be ${SKIP_SMS_PHONE}, got ${digits || "(missing)"}`,
    );
  }
}

function argValue(flag) {
  const eq = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function isoDatePlusDays(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const preferredDate = isoDatePlusDays(3);

function notes(slug) {
  return [
    "AUTOMATION TEST BOOKING — please ignore",
    `Site: ${slug}`,
    `Run id: ${stamp}`,
  ].join("\n");
}

function simpleBody(slug) {
  return {
    customer_name: CUSTOMER_NAME,
    email: TEST_EMAIL,
    phone: SKIP_SMS_PHONE,
    address: "123 Probe St",
    service_type: "Standard Clean",
    preferred_date: preferredDate,
    preferred_time: "morning",
    notes: notes(slug),
    intent: "quote",
  };
}

function calculatorBody(slug) {
  return {
    bookingId: `probe-${slug}-${stamp}`,
    bookingData: {
      firstName: "BB",
      lastName: "Probe Test",
      email: TEST_EMAIL,
      phone: SKIP_SMS_PHONE,
      address: "123 Probe St",
      keyInfo: "Automation test — ignore",
      service: "Standard Clean",
      bedrooms: 2,
      bathrooms: 2,
      customerNote: notes(slug),
      scheduledDate: preferredDate,
      scheduledTime: "morning",
    },
  };
}

function weeklyBody(slug) {
  return {
    serviceSlug: "home-cleaning",
    pricingDetails: {
      bedrooms: 2,
      bathrooms: 2,
      sqft: 1800,
      frequency: "weekly",
    },
    preferredDate,
    timeWindow: "morning",
    name: CUSTOMER_NAME,
    email: TEST_EMAIL,
    phone: SKIP_SMS_PHONE,
    streetAddress: "123 Probe St",
    city: "Orlando",
    notes: notes(slug),
  };
}

function davenportBody(slug) {
  return {
    name: CUSTOMER_NAME,
    email: TEST_EMAIL,
    phone: SKIP_SMS_PHONE,
    zip: "33837",
    address: "123 Probe St, Davenport, FL 33837",
    serviceType: "house",
    sqft: 1800,
    bedrooms: 2,
    bathrooms: 2,
    frequency: "one-time",
    addons: [],
    intent: "quote",
    preferredDate,
    timeWindow: "morning",
    notes: notes(slug),
    source: "booking-broom-probe",
  };
}

/**
 * Matches Windermere DEFAULT_PRICING_CONFIG for house-cleaning / house /
 * 2 bed / 2 bath / 1500-2500 / one-time / no add-ons (cents).
 * Live Booking Broom prices may differ; the site allows $1 of drift.
 */
const WINDERMERE_ESTIMATE_CENTS = 31900;

function windermereBody(slug) {
  return {
    quote: {
      service: "house-cleaning",
      propertyType: "house",
      bedrooms: 2,
      bathrooms: 2,
      sqftBand: "1500-2500",
      frequency: "one-time",
      addons: [],
    },
    estimateCents: WINDERMERE_ESTIMATE_CENTS,
    customer: {
      name: CUSTOMER_NAME,
      email: TEST_EMAIL,
      phone: SKIP_SMS_PHONE,
    },
    schedule: {
      preferredDate,
      timeWindow: "morning",
    },
    address: {
      line1: "123 Probe St",
      city: "Windermere",
      state: "FL",
      zip: "34786",
    },
    notes: notes(slug),
  };
}

const SITES = [
  {
    slug: "sanford",
    origin: "https://sanfordcleaning.com",
    path: "/api/emails/confirm-booking",
    kind: "calculator",
  },
  {
    slug: "deltona",
    origin: "https://deltonacleaning.com",
    path: "/api/book",
    kind: "simple",
  },
  {
    slug: "haines-city",
    origin: "https://hainescitycleaning.com",
    path: "/api/book",
    kind: "simple",
  },
  {
    slug: "celebration",
    origin: "https://celebrationcleaning.com",
    path: "/api/bookings",
    kind: "simple",
  },
  {
    slug: "winter-haven",
    origin: "https://cleaningwinterhaven.com",
    path: "/api/book",
    kind: "simple",
  },
  {
    slug: "cleaning-weekly",
    origin: "https://cleaningweekly.com",
    path: "/api/book",
    kind: "weekly",
  },
  {
    slug: "davenport",
    origin: "https://cleaningdavenport.com",
    path: "/api/bookings",
    kind: "davenport",
  },
  {
    slug: "apopka",
    origin: "https://apopkacleaning.com",
    path: "/api/bookings",
    kind: "simple",
  },
  {
    slug: "kissimmee",
    origin: "https://cleaningkissimmee.com",
    path: "/api/bookings",
    kind: "simple",
  },
  {
    slug: "windermere",
    origin: "https://windermerecleaning.com",
    path: "/api/bookings",
    kind: "windermere",
  },
  {
    slug: "boca-raton",
    origin: "https://cleaningbocaraton.com",
    path: "/api/emails/confirm-booking",
    kind: "calculator",
  },
  {
    slug: "sanford-nc",
    origin: "https://cleaningsanford.com",
    path: "/api/book",
    kind: "simple",
  },
];

function payloadFor(site) {
  switch (site.kind) {
    case "calculator":
      return calculatorBody(site.slug);
    case "weekly":
      return weeklyBody(site.slug);
    case "davenport":
      return davenportBody(site.slug);
    case "windermere":
      return windermereBody(site.slug);
    default:
      return simpleBody(site.slug);
  }
}

function passed(site, status, data) {
  if (status < 200 || status >= 300) return false;
  if (!data || typeof data !== "object") return false;
  if (site.kind === "weekly") return data.bookingBroom === true;
  if (site.kind === "calculator") {
    return data.bookingBroom === true || Boolean(data.id);
  }
  return Boolean(data.id) || data.ok === true;
}

function bookingId(data) {
  if (!data || typeof data !== "object") return "";
  return data.id || data.bookingId || "";
}

async function probe(site) {
  const url = `${site.origin}${site.path}`;
  const body = payloadFor(site);
  assertSkipSmsPhone(body, site.slug);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 300) };
    }
    const ok = passed(site, res.status, data);
    return {
      slug: site.slug,
      url,
      status: res.status,
      ok,
      id: bookingId(data),
      error: ok
        ? ""
        : data.error || data.message || data.raw || `HTTP ${res.status}`,
      ms: Date.now() - started,
    };
  } catch (err) {
    return {
      slug: site.slug,
      url,
      status: 0,
      ok: false,
      id: "",
      error: err instanceof Error ? err.message : String(err),
      ms: Date.now() - started,
    };
  }
}

function pad(value, width) {
  const text = String(value);
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

async function main() {
  const filter = argValue("--site");
  const sites = filter ? SITES.filter((s) => s.slug === filter) : SITES;

  if (filter && sites.length === 0) {
    console.error(
      `Unknown --site=${filter}. Known: ${SITES.map((s) => s.slug).join(", ")}`,
    );
    process.exit(1);
  }

  console.log(`Customer email: ${TEST_EMAIL}`);
  console.log(`Phone (SMS skipped): ${SKIP_SMS_PHONE}`);
  console.log(`Preferred date: ${preferredDate}`);
  console.log(`Probing ${sites.length} site(s)…\n`);

  const results = [];
  for (const site of sites) {
    process.stdout.write(`  ${site.slug}… `);
    const result = await probe(site);
    results.push(result);
    console.log(result.ok ? `PASS ${result.id || ""}`.trim() : `FAIL ${result.error}`);
  }

  console.log("");
  console.log(
    `${pad("SITE", 18)}${pad("STATUS", 8)}${pad("RESULT", 8)}${pad("ID", 28)}ERROR`,
  );
  for (const row of results) {
    console.log(
      `${pad(row.slug, 18)}${pad(row.status || "err", 8)}${pad(row.ok ? "PASS" : "FAIL", 8)}${pad(row.id, 28)}${row.error}`,
    );
  }

  const failed = results.filter((r) => !r.ok);
  const passedCount = results.length - failed.length;
  console.log(`\n${passedCount}/${results.length} passed`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
