# Portfolio SEO freshen — 2026-11-15

Evidence: [jev-seo](https://github.com/AgriciDaniel/jev-seo) standard audits of all 13 cleaning domains + code changes across marketing repos and Booking Broom.

## Scoreboard (pre-fix live audit)

| Domain | Score | Cap / note |
|--------|------:|------------|
| cleaningwinterhaven.com | 93 A | Clean HTTPS |
| celebrationcleaning.com | 92 A | Vercel; clean AI Allow |
| apopkacleaning.com | 90 A | Content still the lever |
| windermerecleaning.com | 86 B | Missing H1 (fixed in code) |
| Most CF Workers brands | 60 C | HTTP without HTTPS redirect (fixed in `worker.ts`) |
| cleaninglakeland.com | 60 C | Parking DNS — see `lakeland-go-live.md` |

Digests: [`digests/`](./digests/).

## Implemented in code (this pass)

- HTTP→HTTPS + www→apex in Worker `fetch` for Sanford FL, Kissimmee, Boca, Haines, Deltona, Davenport, Sanford NC, Lakeland; Weekly Astro middleware.
- Sanford FL `/contact` → `/#contact` link + redirect.
- Windermere homepage `<h1>`; book/quote `generateMetadata` (Windermere, Apopka, Kissimmee).
- Portfolio `public/llms.txt` (phone-optional).
- Boca Seminole County geo contamination → Palm Beach County.
- Thin hubs deepened (guides/blog/book/contact across multiple brands).
- BB `isIntentionalNoindexUrl` includes `lakeland`.
- Lakeland wrangler custom domains + HTTPS worker; JsonLd placeholder `sameAs` removed.

## Operator-only (dashboard / DNS)

See [`cloudflare-ai-robots.md`](./cloudflare-ai-robots.md) and [`lakeland-go-live.md`](./lakeland-go-live.md).

Live jev scores above are **pre-deploy**. Worker HTTPS redirects, `llms.txt`, content, and H1 fixes take effect only after each site’s deploy (and Lakeland DNS cutover).

After deploy + CF AI robots + Lakeland DNS:

1. Booking Broom `/seo` → Sync now, Submit sitemaps, Sync index (Google + Bing).
2. Re-run full jev portfolio audit and replace `digests/` (tooling confirmed 2026-11-15: Celebration still **93 A** on a post spot-check).

## Security

Do not commit `.tmp-jev-seo/` (gitignored). Rotate any TypeSafe/jev API key that was pasted into chat.
