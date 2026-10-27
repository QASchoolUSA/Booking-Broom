# Cleaning Lakeland ↔ Booking Broom

Marketing site for **Cleaning Lakeland** (Lakeland, Florida / Polk County hub) at `cleaninglakeland.com`.

## Site registration

| Field | Value |
|-------|--------|
| Slug | `lakeland` |
| Name | Cleaning Lakeland |
| Domain | cleaninglakeland.com |
| Contact email | info@cleaninglakeland.com |
| Accent | `#1E3A8A` (lake cobalt; site lime accent `#84CC16`) |
| Dev API key | `bb_lakeland_dev_key` |
| Worker | `cleaning-lakeland` |
| Cloudflare Account ID | Leave empty until pasted on the Deploys card (new account) |

Seeded via `SEED_SITES` in `convex/lib/apiKeys.ts`. Pricing uses the shared sqft-rate-min engine with Polk **−25%** discount rates (`DISCOUNT_SLUGS` includes `lakeland`).

After deploy, sync:

```bash
CONVEX_AGENT_MODE=anonymous pnpm exec convex run internal.seed.syncSeedSites
CONVEX_AGENT_MODE=anonymous pnpm exec convex run internal.seed.syncSeedPricing
```

(Use your normal Convex deployment env in production instead of `CONVEX_AGENT_MODE=anonymous`.)

## Marketing site env

```
# BOOKING_BROOM_URL optional; defaults to https://app.bookingbroom.com
BOOKING_BROOM_API_KEY=bb_lakeland_dev_key
# BOOKING_BROOM_SITE_SLUG not required — hardcoded in the marketing site
NEXT_PUBLIC_SITE_URL=https://cleaninglakeland.com
```

Quotes and bookings: `POST /api/book` on the marketing site → `POST {BOOKING_BROOM_URL}/api/bookings` with `site_slug: "lakeland"`.

Live pricing: `GET {BOOKING_BROOM_URL}/api/pricing` with `X-Site-Slug: lakeland` and `X-Api-Key`.

## CORS

`src/lib/cors.ts` allows `https://cleaninglakeland.com` and `https://www.cleaninglakeland.com`.

## Email

Confirmation mail should send from the site’s connected SpaceMail mailbox (`info@cleaninglakeland.com` once connected in Booking Broom Email → Connect).

## Cloudflare

New account for this Worker. Create a KV namespace for `BOOKING_OUTBOX`, bind it in the marketing site `wrangler.jsonc`, set `BOOKING_BROOM_API_KEY` as a Worker secret, and paste the Account ID on the Booking Broom Deploys card when ready.
