# Cleaning Sanford (NC) ↔ Booking Broom

Marketing site for **Cleaning Sanford** (Sanford, North Carolina / Lee County) at `cleaningsanford.com`.

Distinct from **Sanford Cleaning** (Florida, slug `sanford` / `sanfordcleaning.com`).

## Site registration

| Field | Value |
|-------|--------|
| Slug | `sanford-nc` |
| Name | Cleaning Sanford |
| Domain | cleaningsanford.com |
| Contact email | info@cleaningsanford.com |
| Accent | `#0F5C5B` |
| Dev API key | `bb_sanford-nc_dev_key` |

Seeded via `SEED_SITES` in `convex/lib/apiKeys.ts`. Pricing uses the bedroom-band engine (`SEED_PRICING`).

After deploy, sync:

```bash
CONVEX_AGENT_MODE=anonymous pnpm exec convex run internal.seed.syncSeedSites
CONVEX_AGENT_MODE=anonymous pnpm exec convex run internal.seed.syncSeedPricing
```

(Use your normal Convex deployment env in production instead of `CONVEX_AGENT_MODE=anonymous`.)

## Marketing site env

```
# BOOKING_BROOM_URL optional; defaults to https://app.bookingbroom.com
BOOKING_BROOM_API_KEY=bb_sanford-nc_dev_key
BOOKING_BROOM_SITE_SLUG=sanford-nc
NEXT_PUBLIC_SITE_URL=https://cleaningsanford.com
```

Quotes and bookings: `POST /api/book` on the marketing site → `POST {BOOKING_BROOM_URL}/api/bookings` with `site_slug: "sanford-nc"`.

Live pricing: `GET {BOOKING_BROOM_URL}/api/pricing` with `X-Site-Slug: sanford-nc` and `X-Api-Key`.

## CORS

`src/lib/cors.ts` allows `https://cleaningsanford.com` and `https://www.cleaningsanford.com`.

## Email

Confirmation mail should send from the site’s connected SpaceMail mailbox (`info@cleaningsanford.com` once connected in Booking Broom Email → Connect).
