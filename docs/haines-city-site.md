# Haines City Cleaning — Booking Broom Integration

## Site registration

| Field | Value |
|-------|-------|
| **site_slug** | `haines-city` |
| **Name** | Haines City Cleaning |
| **Domain** | `hainescitycleaning.com` |
| **Contact email** | `info@hainescitycleaning.com` |

## API key

The seeded Convex hash matches the shared key:

```
BOOKING_BROOM_API_KEY=bb_haines-city_dev_key
```

```
BOOKING_BROOM_URL=https://bookings.kedrik.com
```

For production, generate a stronger key, update `apiKeyHash` in Convex (or `SEED_SITES` + re-sync), and set the new value in Haines City Cleaning's env.

## Haines City Cleaning env vars

**Runtime secrets:**
- `BOOKING_BROOM_URL=https://bookings.kedrik.com`
- `BOOKING_BROOM_API_KEY=bb_haines-city_dev_key`
- `BOOKING_BROOM_SITE_SLUG=haines-city` (optional; defaults to `haines-city`)

## CORS

`https://hainescitycleaning.com` and `https://www.hainescitycleaning.com` are included in default `ALLOWED_ORIGINS`.
Add them to Vercel `ALLOWED_ORIGINS` if you override the default list.

## Email notifications

When Booking Broom SMTP is configured, Haines City bookings use:
- **From / Reply-To** — `Haines City Cleaning <info@hainescitycleaning.com>`
- **Admin notification** — `info@hainescitycleaning.com`

Configure SMTP on the **Booking Broom** Vercel project (see main README).
