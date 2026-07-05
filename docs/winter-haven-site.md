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
