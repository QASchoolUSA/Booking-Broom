# Booking Broom

Manager dashboard PWA for multi-site cleaning businesses. Receive bookings in real time from Sanford Cleaning, Deltona Cleaning, Haines City Cleaning, Celebration Cleaning, Cleaning Winter Haven, and more.

## Stack

- **Next.js 16** (App Router) on Vercel
- **Convex** (database + auth + realtime) — free tier, **no inactivity pause**
- **Tailwind CSS v4** + **shadcn/ui**
- **Serwist** PWA (installable on iPhone, iPad, Android)

## Quick Start

### 1. Convex setup

1. Create a free account at [convex.dev](https://www.convex.dev)
2. Run in the project root:

```bash
npm install
npx convex dev
```

This logs you in, creates a deployment, writes `NEXT_PUBLIC_CONVEX_URL` to `.env.local`, and syncs your backend.

3. In a **second terminal**, start Next.js:

```bash
npm run dev
```

4. Open [http://localhost:3000/login](http://localhost:3000/login) and click **Create manager account** (first-time only), then sign in.

5. **Auth keys (required once per deployment):** If sign-up fails with `Missing JWT_PRIVATE_KEY`, run:

```bash
node scripts/setup-convex-auth.mjs http://localhost:3000
```

For production, use your Vercel URL instead:

```bash
node scripts/setup-convex-auth.mjs https://your-app.vercel.app
```

6. Seed your cleaning sites (run once):

```bash
npx convex run internal.seed.seedSites
```

To add new sites to an **existing** deployment (without wiping data):

```bash
npx convex run internal.seed.syncSeedSites
```

This inserts any entries from `convex/lib/apiKeys.ts` that are not yet in the database.

### 2. Deploy to Vercel

1. Push to GitHub and import in Vercel
2. Add these **Environment Variables** in Vercel (Settings → Environment Variables):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_CONVEX_URL` | `https://dynamic-gnu-491.convex.cloud` |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | `https://dynamic-gnu-491.convex.site` |
| `CONVEX_DEPLOY_KEY` | Your deploy key from [Convex dashboard](https://dashboard.convex.dev/t/nick-kudrow/bookingbroom/dynamic-gnu-491) (Settings → Deploy Key) |
| `ALLOWED_ORIGINS` | `http://localhost:3000,https://sanfordcleaning.com,...` |
| `SMTP_HOST` | `mail.spacemail.com` (optional — omit to disable booking emails) |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | Your SpaceMail mailbox address |
| `SMTP_PASS` | Your SpaceMail mailbox password |
| `SMTP_FROM` | `"Cleaning Winter Haven <info@cleaningwinterhaven.com>"` |

3. Build is configured in `vercel.json` to run `npx convex deploy --cmd 'npm run build'` automatically.

4. After first deploy, run auth setup with your **live Vercel URL** (if not done already):

```bash
node scripts/setup-convex-auth.mjs https://your-app.vercel.app
```

5. Open `/login` → **Create manager account**, then sign in.

**Convex dashboard:** [dynamic-gnu-491](https://dashboard.convex.dev/t/nick-kudrow/bookingbroom/dynamic-gnu-491)

### 3. Install as PWA

- **iPhone/iPad:** Safari → Share → Add to Home Screen
- **Android:** Chrome → Install app

## Seeded Sites

| Slug | Name | Dev API Key |
|------|------|-------------|
| `sanford` | Sanford Cleaning | `bb_sanford_dev_key` |
| `deltona` | Deltona Cleaning | `bb_deltona_dev_key` |
| `haines-city` | Haines City Cleaning | `bb_haines-city_dev_key` |
| `celebration` | Celebration Cleaning | `bb_celebration_dev_key` |

Use the **Test booking** button in development to simulate incoming bookings.

## Public Booking API

When you add booking forms to your cleaning sites, POST to:

```
POST https://your-app.vercel.app/api/bookings
Content-Type: application/json
```

```json
{
  "site_slug": "sanford",
  "api_key": "bb_sanford_dev_key",
  "customer_name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+1 (407) 555-0100",
  "address": "123 Main St, Sanford FL",
  "service_type": "Deep Clean",
  "preferred_date": "2026-07-15",
  "preferred_time": "morning",
  "notes": "2 bed, 2 bath"
}
```

### Example form integration (any Vercel site)

```javascript
async function submitBooking(formData) {
  const res = await fetch("https://your-app.vercel.app/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      site_slug: "sanford",
      api_key: "bb_sanford_dev_key",
      ...formData,
    }),
  });
  if (!res.ok) throw new Error("Booking failed");
  return res.json();
}
```

## Adding a New Site

1. Add the site to `convex/lib/apiKeys.ts` in `SEED_SITES` (generate hash with the command below).
2. Add the domain to default `ALLOWED_ORIGINS` in `src/app/api/bookings/route.ts` (and Vercel env if overridden).
3. Deploy Booking Broom, then sync to Convex:

```bash
npx convex run internal.seed.syncSeedSites
```

Or insert a row manually in the Convex `sites` table via dashboard:

```ts
{
  slug: "new-city",
  name: "New City Cleaning",
  domain: "newcitycleaning.com",
  accentColor: "#0284C7",
  apiKeyHash: "<sha256-hex-of-your-secret-key>",
  createdAt: Date.now(),
}
```

Generate the hash:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('your-secret-key').digest('hex'))"
```

Add the domain to `ALLOWED_ORIGINS` in Vercel env vars.

## Email notifications

When a booking is submitted via the public API, Booking Broom can send:

- **Customer confirmation** — to the email address in the booking (if valid)
- **Admin notification** — to the site-specific admin address in `src/lib/site-emails.ts`

Configure SpaceMail SMTP in Vercel (or `.env.local` for local dev):

| Variable | Example |
|----------|---------|
| `SMTP_HOST` | `mail.spacemail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `info@cleaningwinterhaven.com` |
| `SMTP_PASS` | your mailbox password |
| `SMTP_FROM` | `"Cleaning Winter Haven <info@cleaningwinterhaven.com>"` |

If `SMTP_HOST` is not set, bookings are still saved but no emails are sent.

To add admin email for a new site, add an entry to `ADMIN_EMAILS` in `src/lib/site-emails.ts`.

## Project Structure

```
convex/                     # Convex backend (schema, queries, mutations)
src/
├── app/                    # Pages & API routes
├── components/
│   ├── bookings/           # Booking cards, detail sheet
│   ├── dashboard/          # Main dashboard view
│   └── layout/             # App shell, nav, filters
└── lib/hooks/useBookings.ts  # Convex realtime queries
```

## Dev workflow

Two terminals required:

```bash
# Terminal 1 — Convex backend (always-on cloud, syncs on save)
npx convex dev

# Terminal 2 — Next.js frontend
npm run dev
```

## Cost

| Service | Tier | Monthly | Inactivity pause |
|---------|------|---------|------------------|
| Vercel | Hobby | $0 | No |
| Convex | Free | $0 | **No** |

## Future

- Assign bookings to cleaners
- Cleaner mobile app (React Native + same Convex backend)
- SMS notifications on new bookings

## Email notifications

After a successful booking, Booking Broom sends:

1. **Customer confirmation** — to the email address on the booking (if provided)
2. **Admin notification** — to the site-specific inbox (e.g. `info@cleaningwinterhaven.com` for Winter Haven)

Emails are sent from this app (Vercel/Node) via SMTP. Cleaning sites on Cloudflare Workers do not send email directly.

### SMTP setup (SpaceMail)

Add these env vars in **Vercel** (Booking Broom project):

| Variable | Example |
|----------|---------|
| `SMTP_HOST` | `mail.spacemail.com` |
| `SMTP_PORT` | `465` (SSL) or `587` (STARTTLS) |
| `SMTP_USER` | `info@cleaningwinterhaven.com` |
| `SMTP_PASS` | Your SpaceMail mailbox password (secret) |
| `SMTP_FROM` | `Cleaning Winter Haven <info@cleaningwinterhaven.com>` |

If `SMTP_HOST` is not set, bookings still succeed — emails are skipped (useful for local dev).

Site-specific admin inboxes are configured in `src/lib/site-emails.ts`.
