# Booking Broom

Manager dashboard PWA for multi-site cleaning businesses. Receive bookings in real time from Sanford Cleaning, Deltona Cleaning, Haines City Cleaning, Celebration Cleaning, Cleaning Winter Haven, Cleaning Weekly, and more.

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

This inserts any entries from `convex/lib/apiKeys.ts` that are not yet in the database,
and backfills `contactEmail` (and other seed fields) on existing sites.

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
| `SMTP_USER` | Your SpaceMail mailbox address (SMTP auth only) |
| `SMTP_PASS` | Your SpaceMail mailbox password |
| `SMTP_FROM` | Fallback From address for unknown site slugs only |

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
| `winter-haven` | Cleaning Winter Haven | `bb_winter-haven_dev_key` |
| `cleaning-weekly` | Cleaning Weekly | `bb_cleaning-weekly_dev_key` |

Use the **Test booking** button in development to simulate incoming bookings.

Site-specific production keys and env setup: see `docs/winter-haven-site.md`, `docs/cleaning-weekly-site.md`, `docs/celebration-site.md`, and `docs/sanford-site.md`.

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

- **Customer confirmation** — to the email address in the booking (if valid), From/Reply-To set to that cleaning site’s inbox
- **Admin notification** — to the same site-specific inbox (e.g. Sanford → `info@sanfordcleaning.com`)

| Site | Admin / From email |
|------|--------------------|
| Sanford Cleaning | `info@sanfordcleaning.com` |
| Deltona Cleaning | `info@deltonacleaning.com` |
| Haines City Cleaning | `info@hainescitycleaning.com` |
| Celebration Cleaning | `info@celebrationcleaning.com` |
| Cleaning Winter Haven | `info@cleaningwinterhaven.com` |
| Cleaning Weekly | `info@cleaningweekly.com` |

Configure SpaceMail SMTP in Vercel (or `.env.local` for local dev):

| Variable | Example |
|----------|---------|
| `SMTP_HOST` | `mail.spacemail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | Your SpaceMail mailbox used for SMTP auth |
| `SMTP_PASS` | your mailbox password |
| `SMTP_FROM` | Fallback only if the site slug is unknown |

If `SMTP_HOST` is not set, bookings are still saved but no emails are sent.

Site emails live in `src/lib/site-emails.ts` and as `contactEmail` on each seeded site in `convex/lib/apiKeys.ts`. After deploying, backfill existing deployments with:

```bash
npx convex run internal.seed.syncSeedSites
```

To add a new site’s inbox, update both files and re-run sync.

## Google Search Console (SEO page)

The **SEO** page (`/seo`) syncs clicks, impressions, CTR, and average position from Google Search Console for each cleaning site.

### One-time Google Cloud setup

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create (or pick) a project.
2. Enable the **Google Search Console API**.
3. Create an **OAuth 2.0 Client ID** (Application type: Web application).
4. Add an authorized redirect URI:

```
https://YOUR_DEPLOYMENT.convex.site/gsc/oauth/callback
```

Use the same host as `NEXT_PUBLIC_CONVEX_SITE_URL` / Convex HTTP actions (local anonymous backend uses `http://127.0.0.1:3211`).

5. Set Convex environment variables:

```bash
npx convex env set GOOGLE_CLIENT_ID "your-client-id.apps.googleusercontent.com"
npx convex env set GOOGLE_CLIENT_SECRET "your-client-secret"
# Optional: fallback redirect origin if OAuth state is missing
npx convex env set APP_URL "http://localhost:3000"
```

For anonymous local Convex:

```bash
CONVEX_AGENT_MODE=anonymous npx convex env set GOOGLE_CLIENT_ID "..."
CONVEX_AGENT_MODE=anonymous npx convex env set GOOGLE_CLIENT_SECRET "..."
CONVEX_AGENT_MODE=anonymous npx convex env set APP_URL "http://localhost:3000"
```

6. Ensure each cleaning site property exists in the Google account you connect (Domain or URL-prefix property). Domains are matched automatically to `sites.domain`; if a match fails, set a property override on the SEO page card.

7. In the app: open **SEO** → **Connect Google** → approve readonly Search Console access. Metrics sync daily at 06:00 UTC and on demand via **Sync now**.

## Project Structure

```
convex/                     # Convex backend (schema, queries, mutations)
src/
├── app/                    # Pages & API routes
├── components/
│   ├── bookings/           # Booking cards, detail sheet
│   ├── dashboard/          # Main dashboard view
│   ├── seo/                # Search Console overview & site cards
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

1. **Customer confirmation** — to the email address on the booking (if provided), branded as that cleaning site
2. **Admin notification** — to the site-specific inbox (e.g. `info@sanfordcleaning.com` for Sanford)

Emails are sent from this app (Vercel/Node) via SMTP. Cleaning sites on Cloudflare Workers do not send email directly.

### SMTP setup (SpaceMail)

Add these env vars in **Vercel** (Booking Broom project):

| Variable | Example |
|----------|---------|
| `SMTP_HOST` | `mail.spacemail.com` |
| `SMTP_PORT` | `465` (SSL) or `587` (STARTTLS) |
| `SMTP_USER` | Your SpaceMail mailbox address (auth) |
| `SMTP_PASS` | Your SpaceMail mailbox password (secret) |
| `SMTP_FROM` | Fallback From for unknown site slugs only |

If `SMTP_HOST` is not set, bookings still succeed — emails are skipped (useful for local dev).

Each cleaning website has its own From address and admin inbox in `src/lib/site-emails.ts` (mirrored as `contactEmail` on seeded Convex sites).
