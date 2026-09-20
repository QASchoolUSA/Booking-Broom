# Booking Broom SEO / GEO / AEO Full Audits — 2026-09-13

Full live audits of **8 marketing sites** (excluded: Cleaning Davenport, Deltona Cleaning, Cleaning Winter Haven, Haines City Cleaning).

**Method:** Homepage + robots.txt + sitemap + meaningful content pages (FAQ, about, services, guides/blog, locations). HTML-level evidence only — not GSC/backlinks/CWV.

**Deliverable phase:** findings + prioritized backlog only (no code changes in this pass).

**PDF:** LibreOffice/`soffice` not available in this environment — DOCX reports only. Open in Word/Pages/Google Docs to export PDF if needed.

---

## Scoreboard

| Site | SEO | GEO | AEO | Combined | vs Jul 2026 | DOCX |
|------|----:|----:|----:|---------:|-------------|------|
| [Sanford Cleaning (FL)](https://sanfordcleaning.com) | 8 | 7 | 9 | **24/30** | was 7/8/8 | [report](./seo-geo-aeo-full-audit-sanfordcleaning-com-2026-09-13.docx) |
| [Cleaning Sanford (NC)](https://cleaningsanford.com) | 8 | 7 | 8 | **23/30** | — | [report](./seo-geo-aeo-full-audit-cleaningsanford-com-2026-09-13.docx) |
| [Cleaning Weekly](https://cleaningweekly.com) | 7 | 6 | 8 | **21/30** | was 5/4/7 | [report](./seo-geo-aeo-full-audit-cleaningweekly-com-2026-09-13.docx) |
| [Cleaning Boca Raton](https://cleaningbocaraton.com) | 6 | 4 | 7 | **17/30** | — | [report](./seo-geo-aeo-full-audit-cleaningbocaraton-com-2026-09-13.docx) |
| [Celebration Cleaning](https://celebrationcleaning.com) | 5 | 6 | 6 | **17/30** | was 5/6/5 | [report](./seo-geo-aeo-full-audit-celebrationcleaning-com-2026-09-13.docx) |
| [Windermere Cleaning](https://windermerecleaning.com) | 5 | 4 | 6 | **15/30** | — | [report](./seo-geo-aeo-full-audit-windermerecleaning-com-2026-09-13.docx) |
| [Cleaning Kissimmee](https://cleaningkissimmee.com) | 5 | 3 | 2 | **10/30** | — | [report](./seo-geo-aeo-full-audit-cleaningkissimmee-com-2026-09-13.docx) |
| [Apopka Cleaning](https://apopkacleaning.com) | 4 | 2 | 2 | **8/30** | — | [report](./seo-geo-aeo-full-audit-apopkacleaning-com-2026-09-13.docx) |

---

## Portfolio top 3 moves (views → clicks → positions)

1. **Fix trust killers live now** — Apopka `(407) 555-0148` and Boca `(561) 000-0000` placeholder phones; Boca About geo copy still says Seminole County / Sanford leftovers.
2. **Fix discovery plumbing** — Sanford FL + Boca `sitemap.xml` returning **HTTP 500**; Celebration ~126 noindex city×service URLs still in sitemap.
3. **Normalize AI crawl policy** — Cloudflare Managed `Disallow` for GPTBot/Google-Extended conflicts with (or overrides) site `Allow` on most brands; only Celebration has a clean Allow. Publish `llms.txt` where missing.

See [portfolio-backlog.md](./portfolio-backlog.md) for the full ranked implementation queue.

---

## Cross-site theme matrix

| Issue | SF FL | Boca | Weekly | Celebration | SF NC | Windermere | Kissimmee | Apopka |
|-------|-------|------|--------|-------------|-------|------------|-----------|--------|
| Placeholder / fake phone | — | **Yes** | — | — | — | — | — | **Yes** |
| Missing phone | — | — | Yes | — | Yes | Yes | — | — |
| Sitemap 500 | **Yes** | **Yes** | — | — | — | — | — | — |
| CF AI Disallow conflict | Conflict | Conflict | Conflict | Clean Allow | Conflict | Disallow wins | Disallow | Disallow |
| `llms.txt` | Yes | Yes (bad phone) | 404 | 404 | 404 | Yes | 404 | 404 |
| JSON-LD | Strong | Strong | Strong | Mid | Strong | Mid | **None** | **None** |
| FAQ / guides | Strong | Strong | Mid | Thin guides | Strong | Thin | **None** | **None** |
| City×service noindex-in-sitemap | — | — | — | **Yes (~126)** | — | — | — | — |
| Homepage H1 missing | — | — | — | — | — | **Yes** | — | Brand-only |

---

## Exclusions

Not audited this round (per scope): Cleaning Davenport, Deltona Cleaning, Cleaning Winter Haven, Haines City Cleaning.
