# Cleaning Boca Raton — Booking Broom Integration

## Site registration

| Field | Value |
|-------|-------|
| **site_slug** | `boca-raton` |
| **Name** | Cleaning Boca Raton |
| **Domain** | `cleaningbocaraton.com` |
| **Accent** | `#0B3D4A` (Palm Atlantic ink) |

## Dev / local testing key

```
BOOKING_BROOM_API_KEY=bb_boca-raton_dev_key
BOOKING_BROOM_URL=http://localhost:3000
BOOKING_BROOM_SITE_SLUG=boca-raton
```

The seeded Convex `apiKeyHash` is SHA-256 of `bb_boca-raton_dev_key`.

## Production env (Cleaning Boca Raton host)

```
# BOOKING_BROOM_URL optional; defaults to https://app.bookingbroom.com
BOOKING_BROOM_API_KEY=bb_boca-raton_dev_key
BOOKING_BROOM_SITE_SLUG=boca-raton
```

Rotate to a stronger production secret when ready: generate a key, SHA-256 hash it, update Convex `sites.apiKeyHash` (or `SEED_SITES` + re-sync), then update the site env.

## Sync site to Convex

```bash
pnpm exec convex run internal.seed.syncSeedSites
pnpm exec convex run internal.seed.syncSeedPricing
# Local anonymous:
CONVEX_AGENT_MODE=anonymous pnpm exec convex run internal.seed.syncSeedSites
CONVEX_AGENT_MODE=anonymous pnpm exec convex run internal.seed.syncSeedPricing
```

Pricing uses the same **inline-wizard** engine as Sanford (shared seed config until customized in the dashboard).

## CORS

`https://cleaningbocaraton.com` and `https://www.cleaningbocaraton.com` are in default `ALLOWED_ORIGINS`.
Add them to Vercel `ALLOWED_ORIGINS` if that env overrides the default.

## Email notifications

Booking emails are sent by **Booking Broom** after each successful booking:

- **Customer** — confirmation (From: Cleaning Boca Raton)
- **Admin** — notification to `hello@cleaningbocaraton.com`

Connect the Boca SpaceMail mailbox in Booking Broom (**Email → Connect**), or ensure Convex has shared `SMTP_*` fallback env vars.

## Example POST

```bash
curl -X POST https://app.bookingbroom.com/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "site_slug": "boca-raton",
    "api_key": "bb_boca-raton_dev_key",
    "customer_name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+1 (561) 555-0100",
    "address": "123 Palmetto Park Rd, Boca Raton FL",
    "service_type": "Deep Cleaning",
    "preferred_date": "2026-08-01",
    "preferred_time": "morning",
    "notes": "Gate code 1234"
  }'
```
