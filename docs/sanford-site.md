# Sanford Cleaning — Booking Broom Integration

## Site registration

| Field | Value |
|-------|-------|
| **site_slug** | `sanford` |
| **Name** | Sanford Cleaning |
| **Domain** | `sanfordcleaning.com` |

## API key

The seeded Convex hash matches the shared key:

```
BOOKING_BROOM_API_KEY=bb_sanford_dev_key
```

```
BOOKING_BROOM_URL=https://bookings.kedrik.com
```

For production, generate a stronger key, update `apiKeyHash` in Convex (or `SEED_SITES` + re-sync), and set the new value in Sanford Cleaning's env.

## Sanford Cleaning env vars

**Runtime secrets:**
- `BOOKING_BROOM_URL=https://bookings.kedrik.com`
- `BOOKING_BROOM_API_KEY=bb_sanford_dev_key`
- `BOOKING_BROOM_SITE_SLUG=sanford` (optional; defaults to `sanford`)

## CORS

`https://sanfordcleaning.com` and `https://www.sanfordcleaning.com` are included in default `ALLOWED_ORIGINS`.
Add them to Vercel `ALLOWED_ORIGINS` if you override the default list.

## Email notifications

Sanford Cleaning continues to send its own SMTP booking emails from `/api/emails/confirm-booking`.
Booking Broom can also send emails when its SMTP is configured — disable one side to avoid duplicates.

When Booking Broom sends mail for a Sanford booking:
- **From / Reply-To** — `Sanford Cleaning <info@sanfordcleaning.com>`
- **Admin notification** — `info@sanfordcleaning.com`
