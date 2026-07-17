# Cleaning Weekly — Booking Broom Integration

## Site registration

| Field | Value |
|-------|-------|
| **site_slug** | `cleaning-weekly` |
| **Name** | Cleaning Weekly |
| **Domain** | `cleaningweekly.com` |

## API key (production)

Use this in Cleaning Weekly's hosting env / `.env`:

```
BOOKING_BROOM_API_KEY=bb_cleaning-weekly_6BzsDxq4zUfwELd72RDdm4l8X3XTTDh1
```

```
BOOKING_BROOM_URL=https://bookings.kedrik.com
```

## Dev / local testing key

The seeded Convex hash matches the **production** key above (same pattern as Winter Haven).
For local Booking Broom testing with `bb_cleaning-weekly_dev_key`, update the site's `apiKeyHash` in Convex to the SHA-256 of that dev key, or POST with the production key.

```
BOOKING_BROOM_API_KEY=bb_cleaning-weekly_dev_key
```

## Cleaning Weekly env vars

**Runtime secrets:**
- `BOOKING_BROOM_URL=https://bookings.kedrik.com`
- `BOOKING_BROOM_API_KEY=bb_cleaning-weekly_6BzsDxq4zUfwELd72RDdm4l8X3XTTDh1`

## Sync site to Convex (if missing)

After deploying Booking Broom code changes:

```bash
pnpm exec convex run internal.seed.syncSeedSites
```

## CORS

`https://cleaningweekly.com` and `https://www.cleaningweekly.com` are included in default `ALLOWED_ORIGINS`.
Add them to Vercel `ALLOWED_ORIGINS` if you override the default list.

## Email notifications

Booking confirmation emails can be sent by **Booking Broom** after each successful booking when SMTP is configured on the Booking Broom deployment.

- **Customer** — confirmation to the email on the booking form (From: Cleaning Weekly)
- **Admin** — notification to `info@cleaningweekly.com`

Cleaning Weekly may also send its own SMTP emails from `/api/book`. To avoid duplicate emails, disable SMTP on one side once Booking Broom SMTP is live.
