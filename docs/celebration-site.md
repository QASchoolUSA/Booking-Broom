# Celebration Cleaning — Booking Broom Integration

## Site registration

| Field | Value |
|-------|-------|
| **site_slug** | `celebration` |
| **Name** | Celebration Cleaning |
| **Domain** | `celebrationcleaning.com` |

## API key

The seeded Convex hash matches the shared key:

```
BOOKING_BROOM_API_KEY=bb_celebration_dev_key
```

```
# BOOKING_BROOM_URL optional; defaults to https://app.bookingbroom.com
```

For production, generate a stronger key, update `apiKeyHash` in Convex (or `SEED_SITES` + re-sync), and set the new value in Celebration Cleaning's env.

Pricing uses the bedroom-band engine (same as Haines City). After deploying Booking Broom, run `pnpm exec convex run internal.seed.syncSeedPricing` so the live dashboard config upgrades from headline-only.

## Celebration Cleaning env vars

**Runtime secrets:**
- `BOOKING_BROOM_URL` — optional; defaults to `https://app.bookingbroom.com` (set only for local BB)
- `BOOKING_BROOM_API_KEY=bb_celebration_dev_key`
- `BOOKING_BROOM_SITE_SLUG=celebration` (optional; defaults to `celebration`)

## CORS

`https://celebrationcleaning.com` and `https://www.celebrationcleaning.com` are included in default `ALLOWED_ORIGINS`.
Add them to Vercel `ALLOWED_ORIGINS` if you override the default list.

## Email notifications

When Booking Broom SMTP is configured, Celebration bookings use:
- **From / Reply-To** — `Celebration Cleaning <info@celebrationcleaning.com>`
- **Admin notification** — `info@celebrationcleaning.com`

Configure SMTP on the **Booking Broom** Convex deployment (see main README).
