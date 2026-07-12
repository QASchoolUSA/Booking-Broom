# Cleaning Davenport — Booking Broom Integration

## Site registration

| Field | Value |
|-------|-------|
| **site_slug** | `davenport` |
| **Name** | Cleaning Davenport |
| **Domain** | `cleaningdavenport.com` |

## API key (production)

Use this in Cleaning Davenport's hosting / `.env.local`:

```
BOOKING_BROOM_API_KEY=<generate-production-secret>
```

```
BOOKING_BROOM_URL=https://bookings.kedrik.com
```

Generate a production key, hash it, and set `apiKeyHash` on the Convex `sites` row (or rotate via dashboard). Seed ships with the dev key hash only.

## Dev / local testing key

```
BOOKING_BROOM_API_KEY=bb_davenport_dev_key
```

```
BOOKING_BROOM_URL=http://localhost:3000
```

(Or whatever port Booking Broom's Next.js server uses locally.)

## Env vars (Cleaning Davenport)

**Runtime secrets:**
- `BOOKING_BROOM_URL=https://bookings.kedrik.com`
- `BOOKING_BROOM_API_KEY=<production-or-dev-key>`
- `BOOKING_BROOM_SITE_SLUG=davenport` (optional; defaults to `davenport`)

## Sync site to Convex (if missing)

After deploying Booking Broom code changes:

```bash
npx convex run internal.seed.syncSeedSites
```

Local anonymous backend:

```bash
CONVEX_AGENT_MODE=anonymous npx convex run internal.seed.syncSeedSites
```

## CORS

`https://cleaningdavenport.com` and `https://www.cleaningdavenport.com` are included in default `ALLOWED_ORIGINS`.
Add to Vercel `ALLOWED_ORIGINS` env if you override the default list.

## Email notifications

Booking confirmation emails are sent by **Booking Broom** (not the Davenport site) after each successful booking:

- **Customer** — confirmation to the email on the booking form (From: Cleaning Davenport)
- **Admin** — notification to `info@cleaningdavenport.com`

Configure SMTP on the **Booking Broom Vercel** project (auth credentials only — From addresses are per site):

```
SMTP_HOST=mail.spacemail.com
SMTP_PORT=465
SMTP_USER=<your SpaceMail mailbox>
SMTP_PASS=<SpaceMail mailbox password>
```

Ensure IMAP/SMTP is enabled for the mailbox in Spacemail Manager. If email fails, the booking still succeeds.

Customer receives: "Booking request received — Cleaning Davenport"
Admin (`info@cleaningdavenport.com`) receives: "New booking — {customer name}"
