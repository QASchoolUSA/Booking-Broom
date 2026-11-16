# Portfolio backlog status after 2026-11-15 freshen

Compared to [`../2026-09-13/portfolio-backlog.md`](../2026-09-13/portfolio-backlog.md).

| Item | Status |
|------|--------|
| Fake phones removed | Done (earlier Wave A) |
| Boca geo Seminole leftovers | **Done in code** (Palm Beach County) |
| Sitemap 500 Sanford/Boca | Done earlier; re-verify after deploy |
| Celebration sitemap↔noindex | Done earlier |
| Kissimmee/Apopka JSON-LD baseline | Kissimmee has LocalBusiness live; Apopka strong |
| Cloudflare AI Managed Disallow | **Docs + robots.ts ready; zone dashboard still required** |
| `llms.txt` portfolio | **Done in code** (phone-optional) |
| Windermere homepage H1 | **Done** |
| Sanford `/contact` 404 | **Done** (link + redirect) |
| HTTP→HTTPS Workers | **Done in code**; deploy required for live effect |
| Lakeland live site | **Blocked on DNS/CF account** — see lakeland-go-live.md |
| Thin guides/blog/book hubs | **Partially done** (major hubs deepened) |
| Service cannibalization | Partial (Sanford residential→house redirect kept) |
| BB intentional noindex + Lakeland | **Done** |
| GSC/Bing submit after plumbing | **Operator**: `/seo` after deploys |

## Deploy checklist (all Workers sites with worker.ts changes)

`pnpm deploy` (or CI) for: Sanford-Cleaning, Cleaning-Kissimmee, Cleaning-Boca-Raton, Haines-City-Cleaning, Deltona-Cleaning, Cleaning-Davenport, Cleaning-Sanford-NC, cleaning-lakeland (after KV+DNS), Cleaning-Weekly, Windermere (H1/content), Apopka (quote/guides), Celebration (`llms.txt` only — Vercel).
