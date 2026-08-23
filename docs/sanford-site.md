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
# BOOKING_BROOM_URL optional; defaults to https://app.bookingbroom.com
```

For production, generate a stronger key, update `apiKeyHash` in Convex (or `SEED_SITES` + re-sync), and set the new value in Sanford Cleaning's env.

## Sanford Cleaning env vars

**Runtime secrets:**
- `BOOKING_BROOM_URL` — optional; defaults to `https://app.bookingbroom.com` (set only for local BB)
- `BOOKING_BROOM_API_KEY=bb_sanford_dev_key`
- `BOOKING_BROOM_SITE_SLUG=sanford` (optional; defaults to `sanford`)

## CORS

`https://sanfordcleaning.com` and `https://www.sanfordcleaning.com` are included in default `ALLOWED_ORIGINS`.
Add them to Vercel `ALLOWED_ORIGINS` if you override the default list.

## Email notifications

Booking confirmations are sent by **Booking Broom** after a successful `/api/bookings` create (not from the Sanford Cloudflare Worker).

Connect the Sanford SpaceMail mailbox in Booking Broom (**Email → Connect**), or ensure Convex has shared `SMTP_*` fallback env vars.

Sanford’s booking payload includes property extras (`condition`, `occupants`, `last_cleaned`, `excluded_areas`). Booking Broom’s email action must accept those fields — older validators rejected them and skipped customer email while still saving the booking.

When Booking Broom sends mail for a Sanford booking:
- **From / Reply-To** — `Sanford Cleaning <info@sanfordcleaning.com>` (or the connected mailbox)
- **Admin notification** — `info@sanfordcleaning.com` (or the connected mailbox)
- **Customer** — confirmation to the address submitted on the booking form
