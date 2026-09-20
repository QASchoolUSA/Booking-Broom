# Portfolio implementation backlog — SEO / GEO / AEO
**Audit date:** 2026-09-13  
**Phase:** Plan only — implement in a follow-up session after review  
**Goal lens:** more views → more clicks → better positions/rankings

Effort: **S** = hours, **M** = 1–3 days, **L** = multi-day / multi-site content.

---

## P0 — Critical (do first)

| # | Action | Sites | Dim | Effort | Lever | Evidence |
|---|--------|-------|-----|--------|-------|----------|
| 1 | Replace placeholder phones with real numbers (site UI, tel:, schema, llms.txt) | **Apopka** `(407) 555-0148`, **Boca** `(561) 000-0000` | GEO/SEO | S | Clicks, trust, Local Pack | Live homepage/FAQ/contact/llms |
| 2 | Fix Boca geo copy contamination (remove Seminole County / Sanford Riverwalk / Winter Park leftovers) | Boca | GEO | M | Positions, AI accuracy | Live `/about`, `/house-cleaning` |
| 3 | Fix live `sitemap.xml` HTTP 500 | Sanford FL, Boca | SEO | M | Views / indexation | Live fetch 500; sitemap.ts uses `fs.readdirSync` (breaks on Workers) |
| 4 | Resolve Celebration sitemap ↔ noindex contradiction (~126 city×service URLs) — either deepen+index or remove from sitemap | Celebration | SEO | M | Crawl budget, views | Sampled 20/20 `noindex,follow` still in sitemap |
| 5 | Lift Apopka + Kissimmee to technical baseline: canonicals, OG/Twitter+image, LocalBusiness/Service/FAQ JSON-LD | Apopka, Kissimmee | SEO | M | Positions | Zero JSON-LD live; Apopka no OG |

---

## P1 — High (next sprint)

| # | Action | Sites | Dim | Effort | Lever |
|---|--------|-------|-----|--------|-------|
| 6 | Normalize Cloudflare Managed AI robots: pick Allow or Disallow; stop conflicting rules | All except Celebration (already clean Allow) | GEO | S–M | AI views / citations |
| 7 | Publish `llms.txt` (facts, pricing bands, CTAs, areas) using Sanford FL as template — with **real** NAP | Weekly, Celebration, Sanford NC, Kissimmee, Apopka; refresh Boca after phone fix | GEO | S each | AI citations |
| 8 | Ship `/faq` + `/guides` (question H3s + FAQPage schema) on Kissimmee + Apopka | Kissimmee, Apopka | AEO | M | Snippets, long-tail views |
| 9 | Add homepage H1 with Windermere + cleaning intent | Windermere | SEO | S | Positions |
| 10 | Add real phones where missing | Weekly, Sanford NC, Windermere | SEO | S | Clicks |
| 11 | Validate or remove AggregateRating (5★ / 3 reviews) | Sanford NC | GEO | S | Rich-result risk |
| 12 | Keyword homepage H1 for Apopka (not brand-only); create `/about` | Apopka | SEO | S–M | Positions / E-E-A-T |

---

## P2 — Medium (compounding)

| # | Action | Sites | Dim | Effort | Lever |
|---|--------|-------|-----|--------|-------|
| 13 | Expand thin service/about pages to 800–1200+ words with inclusions, pricing, neighborhoods | Windermere, Kissimmee, Apopka, Weekly `/book/` | SEO | L | Positions |
| 14 | Convert FAQ `<details>/<summary>` to visible question `<h3>` where FAQ schema is emitted | Weekly, Windermere | AEO | M | Featured snippets |
| 15 | Deepen or prune Weekly city×service uniqueness (avoid thin template spam) | Weekly | SEO | L | Positions |
| 16 | Deduplicate title brand suffixes (`\| Brand \| Brand`) | Sanford FL, Boca, Celebration contact | SEO | S | CTR |
| 17 | Audit Sanford FL root canonical inheritance; Sanford NC relative canonicals → absolute | Sanford FL, Sanford NC | SEO | S | Indexation hygiene |
| 18 | Grow guide corpus on Celebration / Weekly / Windermere toward Sanford depth | Celebration, Weekly, Windermere | AEO | L | Views |
| 19 | Fill verified `sameAs` (GBP, Facebook, Instagram) — remove Wikipedia Cleaning links on Weekly | Weekly, Sanford FL, Boca | GEO | M | Entity / positions |

---

## P3 — Quick wins / polish

| # | Action | Sites | Effort |
|---|--------|-------|--------|
| 20 | Link `llms.txt` from robots.txt / footer | Windermere, Sanford FL, Boca | S |
| 21 | Enrich `/guides` hub with snippets + internal links to cost/Airbnb posts | Sanford FL, Boca | S |
| 22 | Cross-link blog cost posts ↔ service pages | Sanford NC | S |
| 23 | Fix contact title duplication | Celebration | S |
| 24 | Add `og:image` sitewide | Kissimmee (and Apopka with full OG stack) | S |

---

## Suggested implementation waves

### Wave A — Trust & discovery (1–2 days)
Items **1, 2, 3, 4, 9, 12 (H1/phone parts)**  
Unblocks clicks and crawl without large content writes.

### Wave B — Thin-site parity (3–5 days)
Items **5, 7, 8, 6** for Apopka + Kissimmee (+ portfolio robots/`llms.txt`)  
Closes the tier gap vs Sanford FL.

### Wave C — Mid-tier compounding (ongoing)
Items **10, 11, 13–19**  
Positions and AI citations after plumbing is healthy.

---

## Implemented 2026-09-13 (partial Wave A)

- Fake phones removed (email-only): Apopka, Boca
- Sitemaps: Sanford FL + Boca static guide slugs (no `fs`); Celebration pruned noindex city×service URLs
- AI robots Allow normalized: Windermere, Kissimmee, Apopka, Weekly, Sanford NC, Celebration (Sanford FL / Boca already had full set)

Remaining backlog items above are still open for a later session.
