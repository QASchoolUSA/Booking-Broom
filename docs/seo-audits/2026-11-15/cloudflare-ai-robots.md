# Cloudflare AI crawler policy (portfolio)

**Stance:** Allow retrieval/answer bots; block training-only bots when Cloudflare offers the split. Site `robots.ts` already Allows GPTBot, ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot, Google-Extended, Amazonbot, Applebot-Extended.

**Problem (2026-11-15 jev):** On Cloudflare Workers zones, **Managed robots.txt replaces the origin file**, so crawlers see Managed `Disallow` for GPTBot/ClaudeBot/Google-Extended and often **lose `Sitemap:`**. Celebration (Vercel) is the clean reference.

## Per-zone dashboard steps

1. Cloudflare Dashboard → select the site zone.
2. **AI Crawl Control** / **Manage AI Crawlers** (Managed robots.txt).
3. Prefer **disable Managed robots.txt** or “use origin robots.txt” so Next/Astro `robots.ts` + Sitemap are served.
4. If Managed must stay on: set retrieval bots to **Allow** (GPTBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended, Applebot-Extended, Amazonbot as desired). Keep training-only bots (CCBot, Bytespider, etc.) blocked if you want.
5. Zone **SSL/TLS → Edge Certificates → Always Use HTTPS = On** (belt-and-suspenders with Worker HTTP→HTTPS redirects).
6. Verify: `curl -sL https://{domain}/robots.txt` shows AI Allow (or no GPTBot Disallow) and a `Sitemap:` line.

## Sites to update

All Cloudflare Workers brands: Sanford FL, Kissimmee, Boca, Davenport, Weekly, Deltona, Haines, Sanford NC, Windermere, Apopka, Winter Haven, Lakeland (after DNS cutover). Skip Celebration (Vercel).

## After change

Re-run Booking Broom `/seo` → Submit sitemaps; optional jev re-audit to confirm AI bot grid.
