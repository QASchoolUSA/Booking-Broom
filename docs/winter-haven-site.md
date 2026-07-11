# Cleaning Winter Haven — Booking Broom Integration

## Site registration

| Field | Value |
|-------|-------|
| **site_slug** | `winter-haven` |
| **Name** | Cleaning Winter Haven |
| **Domain** | `cleaningwinterhaven.com` |

## API key (production)

Use this in Cleaning Winter Haven's Cloudflare / `.env.local`:

```
BOOKING_BROOM_API_KEY=bb_winter-haven_n_iC6KZ_ssqVtiXtoaUZkFB_Spg-Ckmf
```

```
BOOKING_BROOM_URL=https://bookings.kedrik.com
```

## Dev / local testing key

```
BOOKING_BROOM_API_KEY=bb_winter-haven_dev_key
```

## Cloudflare env vars (Cleaning Winter Haven)

**Build variables:**
- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_PHONE`, `NEXT_PUBLIC_EMAIL`

**Runtime secrets:**
- `BOOKING_BROOM_URL=https://bookings.kedrik.com`
- `BOOKING_BROOM_API_KEY=bb_winter-haven_n_iC6KZ_ssqVtiXtoaUZkFB_Spg-Ckmf`

## Sync site to Convex (if missing)

After deploying Booking Broom code changes:

```bash
npx convex run internal.seed.syncSeedSites
```

## CORS

`https://cleaningwinterhaven.com` is included in default `ALLOWED_ORIGINS`.
Add to Vercel `ALLOWED_ORIGINS` env if you override the default list.

## Email notifications

Booking confirmation emails are sent by **Booking Broom** (not the Winter Haven site) after each successful booking:

- **Customer** — confirmation to the email on the booking form (From: Cleaning Winter Haven)
- **Admin** — notification to `info@cleaningwinterhaven.com`

Configure SMTP on the **Booking Broom Vercel** project (auth credentials only — From addresses are per site):

```
SMTP_HOST=mail.spacemail.com
SMTP_PORT=465
SMTP_USER=<your SpaceMail mailbox>
SMTP_PASS=<SpaceMail mailbox password>
```

Ensure IMAP/SMTP is enabled for the mailbox in Spacemail Manager. If email fails, the booking still succeeds.

Customer receives: "Booking request received — Cleaning Winter Haven"
Admin (`info@cleaningwinterhaven.com`) receives: "New booking — {customer name}"
