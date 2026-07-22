# Apopka Cleaning — Booking Broom Integration

## Site registration

| Field | Value |
|-------|-------|
| **site_slug** | `apopka` |
| **Name** | Apopka Cleaning |
| **Domain** | `apopkacleaning.com` |

## Dev / local testing key

```
BOOKING_BROOM_API_KEY=bb_apopka_dev_key
BOOKING_BROOM_URL=http://localhost:3000
BOOKING_BROOM_SITE_SLUG=apopka
```

## Production env (Apopka Cleaning host)

```
BOOKING_BROOM_URL=https://bookings.kedrik.com
BOOKING_BROOM_API_KEY=bb_apopka_dev_key
BOOKING_BROOM_SITE_SLUG=apopka
```

Rotate to a stronger production secret when ready: generate a key, SHA-256 hash it, update Convex `sites.apiKeyHash` (or re-seed), then update the site env.

## Sync site to Convex

```bash
pnpm exec convex run internal.seed.syncSeedSites
# Local anonymous:
CONVEX_AGENT_MODE=anonymous pnpm exec convex run internal.seed.syncSeedSites
```

## CORS

`https://apopkacleaning.com` and `https://www.apopkacleaning.com` are in default `ALLOWED_ORIGINS`.
Add them to Vercel `ALLOWED_ORIGINS` if that env overrides the default.

## Email notifications

Booking emails are sent by **Booking Broom** after each successful booking:

- **Customer** — confirmation (From: Apopka Cleaning)
- **Admin** — notification to `hello@apopkacleaning.com`

## Example POST

```bash
curl -X POST https://bookings.kedrik.com/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "site_slug": "apopka",
    "api_key": "bb_apopka_dev_key",
    "customer_name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+1 (407) 555-0100",
    "address": "123 Main St, Apopka FL",
    "service_type": "Residential Clean",
    "preferred_date": "2026-08-01",
    "preferred_time": "morning",
    "notes": "Gate code 1234"
  }'
```
