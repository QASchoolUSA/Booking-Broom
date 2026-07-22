# Windermere Cleaning — Booking Broom Integration

## Site registration

| Field | Value |
|-------|-------|
| **site_slug** | `windermere` |
| **Name** | Windermere Cleaning |
| **Domain** | `windermerecleaning.com` |

## Dev / local testing key

```
BOOKING_BROOM_MODE=live
BOOKING_BROOM_API_KEY=bb_windermere_dev_key
BOOKING_BROOM_BASE_URL=http://localhost:3000
BOOKING_BROOM_SITE_SLUG=windermere
```

## Production env (Windermere Cleaning host)

```
BOOKING_BROOM_MODE=live
BOOKING_BROOM_BASE_URL=https://bookings.kedrik.com
BOOKING_BROOM_BOOKINGS_PATH=/api/bookings
BOOKING_BROOM_API_KEY=bb_windermere_dev_key
BOOKING_BROOM_SITE_SLUG=windermere
```

The site’s server route maps quote/booking form fields into Booking Broom’s public API body (`site_slug`, `api_key`, `customer_name`, etc.).

Rotate to a stronger production secret when ready: generate a key, SHA-256 hash it, update Convex `sites.apiKeyHash`, then update the site env.

## Sync site to Convex

```bash
pnpm exec convex run internal.seed.syncSeedSites
# Local anonymous:
CONVEX_AGENT_MODE=anonymous pnpm exec convex run internal.seed.syncSeedSites
```

## CORS

`https://windermerecleaning.com` and `https://www.windermerecleaning.com` are in default `ALLOWED_ORIGINS`.
Add them to Vercel `ALLOWED_ORIGINS` if that env overrides the default.

## Email notifications

Booking emails are sent by **Booking Broom** after each successful booking:

- **Customer** — confirmation (From: Windermere Cleaning)
- **Admin** — notification to `hello@windermerecleaning.com`

## Example POST

```bash
curl -X POST https://bookings.kedrik.com/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "site_slug": "windermere",
    "api_key": "bb_windermere_dev_key",
    "customer_name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+1 (407) 555-0100",
    "address": "123 Main St, Windermere FL 34786",
    "service_type": "House Cleaning",
    "preferred_date": "2026-08-01",
    "preferred_time": "morning",
    "notes": "Estimate $189 · bi-weekly"
  }'
```
