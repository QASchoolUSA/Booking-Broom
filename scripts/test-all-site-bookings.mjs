#!/usr/bin/env node
/**
 * Probe every live cleaning site's public quote and booking APIs (not Booking
 * Broom directly). A pass means that Worker has credentials and forwarded a row.
 *
 * Uses phone 3212360618 so Booking Broom skips customer SMS.
 * Each pass still creates a real dashboard row and may send emails.
 *
 * Usage:
 *   pnpm test:bookings-all
 *   BOOKING_TEST_EMAIL=you@example.com pnpm test:bookings-all
 *   pnpm test:bookings-all -- --site=haines-city
 *   pnpm test:bookings-all -- --type=quote
 *   pnpm test:bookings-all -- --type=book --site=apopka
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

function notes(slug, type) {
  return [
    "AUTOMATION TEST BOOKING — please ignore",
    `Site: ${slug}`,
    `Type: ${type}`,
    `Run id: ${stamp}`,
  ].join("\n");
}

function simpleBody(slug, type) {
  return {
    customer_name: CUSTOMER_NAME,
    email: TEST_EMAIL,
    phone: SKIP_SMS_PHONE,
    address: "123 Probe St",
    service_type: "Standard Clean",
    preferred_date: preferredDate,
    preferred_time: "morning",
    notes: notes(slug, type),
    intent: type,
  };
}

function calculatorBookBody(slug) {
  return {
    bookingId: `probe-${slug}-book-${stamp}`,
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
      customerNote: notes(slug, "book"),
      scheduledDate: preferredDate,
      scheduledTime: "morning",
    },
  };
}

function calculatorQuoteBody(slug) {
  return {
    name: CUSTOMER_NAME,
    email: TEST_EMAIL,
    phone: SKIP_SMS_PHONE,
    service: "Standard Clean",
    message: notes(slug, "quote"),
  };
}

function weeklyBookBody(slug) {
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
    notes: notes(slug, "book"),
  };
}

function weeklyQuoteBody(slug) {
  return {
    name: CUSTOMER_NAME,
    email: TEST_EMAIL,
    phone: SKIP_SMS_PHONE,
    service: "home",
    city: "Orlando",
    message: notes(slug, "quote"),
  };
}

function davenportBody(slug, type) {
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
    intent: type,
    preferredDate,
    timeWindow: "morning",
    notes: notes(slug, type),
    source: "booking-broom-probe",
  };
}

/**
 * Matches Windermere DEFAULT_PRICING_CONFIG for house-cleaning / house /
 * 2 bed / 2 bath / 1500-2500 / one-time / no add-ons (cents).
 * Live Booking Broom prices may differ; the site allows $1 of drift.
 */
const WINDERMERE_ESTIMATE_CENTS = 31900;

function windermereBody(slug, type) {
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
    notes: notes(slug, type),
    intent: type,
  };
}

const SITES = [
  {
    slug: "sanford",
    origin: "https://sanfordcleaning.com",
    kind: "calculator",
    bookPath: "/api/emails/confirm-booking",
    quotePath: "/api/emails/quote-request",
  },
  {
    slug: "deltona",
    origin: "https://deltonacleaning.com",
    kind: "simple",
    bookPath: "/api/book",
    quotePath: "/api/book",
  },
  {
    slug: "haines-city",
    origin: "https://hainescitycleaning.com",
    kind: "simple",
    bookPath: "/api/book",
    quotePath: "/api/book",
  },
  {
    slug: "celebration",
    origin: "https://celebrationcleaning.com",
    kind: "simple",
    bookPath: "/api/bookings",
    quotePath: "/api/bookings",
  },
  {
    slug: "winter-haven",
    origin: "https://cleaningwinterhaven.com",
    kind: "simple",
    bookPath: "/api/book",
    quotePath: "/api/book",
  },
  {
    slug: "cleaning-weekly",
    origin: "https://cleaningweekly.com",
    kind: "weekly",
    bookPath: "/api/book",
    quotePath: "/api/quote",
  },
  {
    slug: "davenport",
    origin: "https://cleaningdavenport.com",
    kind: "davenport",
    bookPath: "/api/bookings",
    quotePath: "/api/bookings",
  },
  {
    slug: "apopka",
    origin: "https://apopkacleaning.com",
    kind: "simple",
    bookPath: "/api/bookings",
    quotePath: "/api/bookings",
  },
  {
    slug: "kissimmee",
    origin: "https://cleaningkissimmee.com",
    kind: "simple",
    bookPath: "/api/bookings",
    quotePath: "/api/bookings",
  },
  {
    slug: "windermere",
    origin: "https://windermerecleaning.com",
    kind: "windermere",
    bookPath: "/api/bookings",
    quotePath: "/api/bookings",
  },
  {
    slug: "boca-raton",
    origin: "https://cleaningbocaraton.com",
    kind: "calculator",
    bookPath: "/api/emails/confirm-booking",
    quotePath: "/api/emails/quote-request",
  },
  {
    slug: "sanford-nc",
    origin: "https://cleaningsanford.com",
    kind: "simple",
    bookPath: "/api/book",
    quotePath: "/api/book",
  },
];

function pathFor(site, type) {
  return type === "quote" ? site.quotePath : site.bookPath;
}

function payloadFor(site, type) {
  switch (site.kind) {
    case "calculator":
      return type === "quote"
        ? calculatorQuoteBody(site.slug)
        : calculatorBookBody(site.slug);
    case "weekly":
      return type === "quote"
        ? weeklyQuoteBody(site.slug)
        : weeklyBookBody(site.slug);
    case "davenport":
      return davenportBody(site.slug, type);
    case "windermere":
      return windermereBody(site.slug, type);
    default:
      return simpleBody(site.slug, type);
  }
}

function passed(site, type, status, data) {
  if (status < 200 || status >= 300) return false;
  if (!data || typeof data !== "object") return false;
  if (site.kind === "weekly" && type === "book") {
    return data.bookingBroom === true;
  }
  if (site.kind === "weekly" && type === "quote") {
    return data.ok === true && Boolean(data.id);
  }
  if (site.kind === "calculator" && type === "quote") {
    return data.ok === true && Boolean(data.id);
  }
  if (site.kind === "calculator") {
    return data.bookingBroom === true || Boolean(data.id);
  }
  return Boolean(data.id) || data.ok === true;
}

function bookingId(data) {
  if (!data || typeof data !== "object") return "";
  return data.id || data.bookingId || "";
}

async function probe(site, type) {
  const url = `${site.origin}${pathFor(site, type)}`;
  const body = payloadFor(site, type);
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
    const ok = passed(site, type, res.status, data);
    return {
      slug: site.slug,
      type,
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
      type,
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
  const typeArg = argValue("--type") ?? "all";
  const sites = filter ? SITES.filter((s) => s.slug === filter) : SITES;

  if (filter && sites.length === 0) {
    console.error(
      `Unknown --site=${filter}. Known: ${SITES.map((s) => s.slug).join(", ")}`,
    );
    process.exit(1);
  }

  if (typeArg !== "quote" && typeArg !== "book" && typeArg !== "all") {
    console.error(`Unknown --type=${typeArg}. Use quote, book, or all.`);
    process.exit(1);
  }

  const types = typeArg === "all" ? ["quote", "book"] : [typeArg];

  console.log(`Customer email: ${TEST_EMAIL}`);
  console.log(`Phone (SMS skipped): ${SKIP_SMS_PHONE}`);
  console.log(`Preferred date: ${preferredDate}`);
  console.log(
    `Probing ${sites.length} site(s) × ${types.join("+")} (${sites.length * types.length} requests)…\n`,
  );

  const results = [];
  for (const site of sites) {
    for (const type of types) {
      process.stdout.write(`  ${site.slug} ${type}… `);
      const result = await probe(site, type);
      results.push(result);
      console.log(
        result.ok ? `PASS ${result.id || ""}`.trim() : `FAIL ${result.error}`,
      );
    }
  }

  console.log("");
  console.log(
    `${pad("SITE", 18)}${pad("TYPE", 8)}${pad("STATUS", 8)}${pad("RESULT", 8)}${pad("ID", 28)}ERROR`,
  );
  for (const row of results) {
    console.log(
      `${pad(row.slug, 18)}${pad(row.type, 8)}${pad(row.status || "err", 8)}${pad(row.ok ? "PASS" : "FAIL", 8)}${pad(row.id, 28)}${row.error}`,
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
