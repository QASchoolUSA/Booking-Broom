# Deltona Cleaning — Booking Broom Integration

## Site registration

| Field | Value |
|-------|-------|
| **site_slug** | `deltona` |
| **Name** | Deltona Cleaning |
| **Domain** | `deltonacleaning.com` |
| **Contact email** | `info@deltonacleaning.com` |

## API key

The seeded Convex hash matches the shared key:

```
BOOKING_BROOM_API_KEY=bb_deltona_dev_key
```

```
BOOKING_BROOM_URL=https://bookings.kedrik.com
```

For production, generate a stronger key, update `apiKeyHash` in Convex (or `SEED_SITES` + re-sync), and set the new value in Deltona Cleaning's env.

## Deltona Cleaning env vars

**Runtime secrets:**
- `BOOKING_BROOM_URL=https://bookings.kedrik.com`
- `BOOKING_BROOM_API_KEY=bb_deltona_dev_key`
- `BOOKING_BROOM_SITE_SLUG=deltona` (optional; defaults to `deltona`)

## CORS

`https://deltonacleaning.com` and `https://www.deltonacleaning.com` are included in default `ALLOWED_ORIGINS`.
Add them to Vercel `ALLOWED_ORIGINS` if you override the default list.

## Email notifications

When Booking Broom SMTP is configured, Deltona bookings use:
- **From / Reply-To** — `Deltona Cleaning <info@deltonacleaning.com>`
- **Admin notification** — `info@deltonacleaning.com`

Configure SMTP on the **Booking Broom** Vercel project (see main README).
