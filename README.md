# Booking Broom

Manager dashboard PWA for multi-site cleaning businesses. Receive bookings in real time from Sanford Cleaning, Deltona Cleaning, Haines City Cleaning, Celebration Cleaning, and more.

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

### 2. Deploy to Vercel

1. Push to GitHub and import in Vercel
2. Add these **Environment Variables** in Vercel (Settings → Environment Variables):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_CONVEX_URL` | `https://dynamic-gnu-491.convex.cloud` |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | `https://dynamic-gnu-491.convex.site` |
| `CONVEX_DEPLOY_KEY` | Your deploy key from [Convex dashboard](https://dashboard.convex.dev/t/nick-kudrow/bookingbroom/dynamic-gnu-491) (Settings → Deploy Key) |
| `ALLOWED_ORIGINS` | `http://localhost:3000,https://sanfordcleaning.com,...` |

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

Insert a row in the Convex `sites` table via dashboard or mutation:

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
- Email/SMS notifications on new bookings
