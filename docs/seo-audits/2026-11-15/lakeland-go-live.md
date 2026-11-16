# Lakeland go-live checklist

**Status (2026-11-15):** Domain `cleaninglakeland.com` still points at parking IP `185.53.179.128` (HTTP 410 / HTTPS timeout). Repo is deploy-ready; DNS + Cloudflare account wiring required.

## Code already prepared in repo

- `worker.ts` — HTTP→HTTPS + www→apex 301 (Apopka pattern)
- `wrangler.jsonc` — custom domain routes for apex + www
- `public/llms.txt` — phone-optional facts (when present)
- Booking Broom intentional noindex filter includes `lakeland` city×service paths

## Operator steps (needs Cloudflare login + registrar)

1. Move DNS off parking; use Cloudflare nameservers on the Lakeland CF account (or point apex/www to the Worker custom domain).
2. Create KV namespace for `BOOKING_OUTBOX`; replace `REPLACE_WITH_LAKELAND_BOOKING_OUTBOX_KV_ID` in `wrangler.jsonc`.
3. `wrangler secret put BOOKING_BROOM_API_KEY` (prod key).
4. Enable **Always Use HTTPS**; fix AI Managed robots (see `cloudflare-ai-robots.md`).
5. From `/Users/kedrovnick/cleaning-lakeland`: `pnpm deploy`.
6. Verify: `https://cleaninglakeland.com` → real Next app; `http://` → 301 https; `/sitemap.xml` + `/robots.txt` OK.
7. Booking Broom: paste Cloudflare Account ID on Deploys card; sync seed sites/pricing; connect SpaceMail.
8. Re-run jev: `bin/jevseo audit https://cleaninglakeland.com`.
