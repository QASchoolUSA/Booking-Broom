/**
 * Generates per-site SEO/GEO/AEO DOCX reports for the 2026-09-13 portfolio audit.
 */
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak,
} from "docx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "..");

const NAVY = "1B2A4A";
const ACCENT = "2563EB";
const GREEN = "16A34A";
const AMBER = "D97706";
const RED = "DC2626";
const ORANGE = "EA580C";
const LIGHT = "EFF6FF";
const GRAY = "F8F9FA";
const BORDER = "E2E8F0";
const DARK = "1E293B";
const W = 9360;

const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: none, bottom: none, left: none, right: none };
const thin = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
const thinBorders = { top: thin, bottom: thin, left: thin, right: thin };

function scoreColor(n) {
  if (n >= 8) return GREEN;
  if (n >= 5) return AMBER;
  return RED;
}
function scoreStatus(n) {
  if (n >= 8) return "Strong";
  if (n >= 5) return "On Track";
  return "Needs Work";
}
function prioColor(p) {
  if (p === "Critical") return RED;
  if (p === "High") return ORANGE;
  if (p === "Medium") return AMBER;
  return GREEN;
}

function cell(text, opts = {}) {
  const {
    bold = false, fill, color = DARK, width = W / 3, align = AlignmentType.LEFT,
    fontSize = 18, borders = thinBorders, vAlign = VerticalAlign.CENTER,
  } = opts;
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
    verticalAlign: vAlign,
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text: String(text),
            bold,
            size: fontSize,
            font: "Arial",
            color: fill && (fill === RED || fill === GREEN || fill === AMBER || fill === ORANGE || fill === NAVY) ? "FFFFFF" : color,
          }),
        ],
      }),
    ],
  });
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true, font: "Arial", color: NAVY, size: level === HeadingLevel.HEADING_1 ? 32 : 24 })],
  });
}

function body(text) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, font: "Arial", size: 22, color: DARK })],
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { after: 60 },
    indent: { left: 360 },
    children: [new TextRun({ text: `• ${text}`, font: "Arial", size: 20, color: DARK })],
  });
}

const SITES = [
  {
    id: "sanfordcleaning-com",
    name: "Sanford Cleaning (FL)",
    domain: "sanfordcleaning.com",
    url: "https://sanfordcleaning.com",
    seo: 8, geo: 7, aeo: 9,
    baseline: "Jul 2026: SEO 7 / GEO 8 / AEO 8",
    pages: [
      ["/", "Homepage", "Strong local H1, pricing, service grid"],
      ["/faq", "FAQ", "12 question H3s + direct answers"],
      ["/about", "About", "E-E-A-T + Topaz West LLC entity"],
      ["/house-cleaning", "Service", "Pricing table + local tips; title brand duplicated"],
      ["/guides", "Guides hub", "~19 guides in codebase; hub thin in fetch"],
      ["/llms.txt", "GEO file", "Excellent factual llms.txt"],
      ["/robots.txt", "Robots", "CF Disallow vs site Allow conflict for AI bots"],
      ["/sitemap.xml", "Sitemap", "HTTP 500 on live fetch — critical"],
    ],
    summary:
      "Portfolio leader for AEO and local content depth. Real phone (321) 236-0618, rich FAQ with question H3s, published pricing bands, legal entity Topaz West LLC, and an exemplary llms.txt. Urgent issues: live sitemap.xml returns 500 (Workers/fs issue), and Cloudflare Managed robots Disallow GPTBot/Google-Extended while the site later Allows them — conflicting signals that can cut AI citations and crawl reliability.",
    seoFindings: [
      ["Title/meta", "Strong local intent titles; some pages duplicate brand ('| Sanford Cleaning | Sanford Cleaning')", "Needs Attention"],
      ["Canonical", "Present on key pages in architecture; verify root layout does not inherit homepage-only canonical", "Needs Attention"],
      ["H1", "Singular keyword-rich H1s on home/FAQ/about/services", "Good"],
      ["Content depth", "Homepage and services deep; ~19 guides; pricing ranges published", "Good"],
      ["Structured data", "LocalBusiness / ProfessionalService / FAQPage / HowTo / entity graph (code + llms claims)", "Good"],
      ["Sitemap", "Live /sitemap.xml HTTP 500 — indexation risk", "Missing"],
      ["Internal links", "Service cross-links + area mentions strong", "Good"],
    ],
    geoFindings: [
      ["E-E-A-T", "Named legal entity, years in market, phone/email, insured claims", "Good"],
      ["llms.txt", "Present with facts, pricing, CTA templates, service areas", "Good"],
      ["AI robots", "CF Managed Disallow GPTBot/Google-Extended/ClaudeBot conflicts with later Allow", "Needs Attention"],
      ["sameAs", "Facebook/Instagram in llms; BBB/Yelp placeholders pending", "Needs Attention"],
      ["Factual density", "High — prices, areas, how-we-work steps", "Good"],
    ],
    aeoFindings: [
      ["Question H3s", "FAQ page uses ### How much… / What areas… pattern", "Good"],
      ["Direct answers", "40–60 word pricing answers under questions", "Good"],
      ["FAQ schema", "FAQPage claimed on service/FAQ surfaces", "Good"],
      ["Tables/lists", "Standard vs Deep comparison table on service pages", "Good"],
      ["Voice/local", "NAP locality Sanford FL 32771; conversational booking answers", "Good"],
    ],
    priorities: [
      ["Critical", "Fix live sitemap.xml 500 (Cloudflare Workers sitemap generation)", "SEO", "M", "Views/indexation"],
      ["High", "Resolve Cloudflare AI Disallow vs site Allow for GPTBot/Google-Extended/Claude", "GEO", "S", "AI views/citations"],
      ["High", "Deduplicate title brand suffixes; audit root canonical inheritance", "SEO", "S", "CTR/positions"],
      ["Medium", "Fill verified sameAs (GBP/BBB/Yelp) and keep AggregateRating honest", "GEO", "M", "Positions/trust"],
      ["Quick Win", "Enrich /guides hub listing with snippets linking to cost/Airbnb posts", "AEO", "S", "Clicks"],
    ],
    strengths: [
      "Best-in-portfolio FAQ + pricing answer architecture",
      "Real phone and clear mobile service-area policy",
      "llms.txt is a model for other brands",
      "Deep service pages with local humidity/hard-water tips",
    ],
  },
  {
    id: "cleaningbocaraton-com",
    name: "Cleaning Boca Raton",
    domain: "cleaningbocaraton.com",
    url: "https://cleaningbocaraton.com",
    seo: 6, geo: 4, aeo: 7,
    baseline: "First full portfolio audit (Sanford twin stack)",
    pages: [
      ["/", "Homepage", "Strong IA; phone is (561) 000-0000 placeholder"],
      ["/faq", "FAQ", "Question H3s — phone placeholder in answers"],
      ["/about", "About", "GEO contamination: Seminole County / Riverwalk / Winter Park copy"],
      ["/house-cleaning", "Service", "Good depth; title brand duplicated; Seminole County mention"],
      ["/guides", "Guides hub", "~19 guides in codebase"],
      ["/llms.txt", "GEO file", "Present but encodes fake phone +15610000000"],
      ["/robots.txt", "Robots", "Same CF Disallow vs Allow conflict"],
      ["/sitemap.xml", "Sitemap", "HTTP 500 on live fetch"],
    ],
    summary:
      "Structurally near Sanford FL (FAQ, guides, schemas, llms.txt) but trust and entity signals are broken live: phone is (561) 000-0000 across site + llms.txt, and About/service copy still references Seminole County / Sanford geography. Until NAP and geo copy are fixed, rankings and AI citations will underperform the content investment.",
    seoFindings: [
      ["Title/meta", "Local titles OK; brand duplication on service titles", "Needs Attention"],
      ["Content", "Deep service templates + guides corpus", "Good"],
      ["NAP phone", "Placeholder (561) 000-0000 sitewide", "Missing"],
      ["Geo accuracy", "About claims Seminole County / Boca Raton Riverwalk / Winter Park", "Missing"],
      ["Sitemap", "Live /sitemap.xml HTTP 500", "Missing"],
      ["Schema stack", "Same mature component set as Sanford FL", "Good"],
    ],
    geoFindings: [
      ["llms.txt", "Exists but trains models on fake phone", "Needs Attention"],
      ["Entity clarity", "Cleaning Boca Raton LLC present; geography inconsistent", "Needs Attention"],
      ["AI robots", "CF Disallow vs Allow conflict", "Needs Attention"],
      ["Trust", "Fake phone destroys click-to-call and GBP alignment", "Missing"],
    ],
    aeoFindings: [
      ["FAQ H3s", "Present and well structured", "Good"],
      ["Answer quality", "Strong, but CTAs cite fake phone", "Needs Attention"],
      ["Tables/lists", "Standard vs Deep table present", "Good"],
    ],
    priorities: [
      ["Critical", "Replace (561) 000-0000 everywhere (site, schema, llms.txt)", "GEO", "S", "Clicks/trust/positions"],
      ["Critical", "Rewrite Boca About/service geo copy (remove Seminole/Sanford leftovers)", "GEO", "M", "Positions/AI accuracy"],
      ["Critical", "Fix sitemap.xml 500", "SEO", "M", "Views"],
      ["High", "Fix Cloudflare AI bot policy conflict", "GEO", "S", "AI views"],
      ["Medium", "Deduplicate titles; verify Palm Beach County areaServed only", "SEO", "S", "CTR"],
    ],
    strengths: [
      "Mature FAQ/guides/schema twin of Sanford FL",
      "Clear service IA and published pricing bands",
      "llms.txt framework ready once NAP is real",
    ],
  },
  {
    id: "cleaningsanford-com",
    name: "Cleaning Sanford (NC)",
    domain: "cleaningsanford.com",
    url: "https://cleaningsanford.com",
    seo: 8, geo: 7, aeo: 8,
    baseline: "New vs FL Sanford — strong NC disambiguation",
    pages: [
      ["/", "Homepage", "HouseCleaner schema + AggregateRating 5★/3 reviews"],
      ["/pricing", "Pricing", "Strong local intent"],
      ["/areas/*", "Area pages", "Lee County depth"],
      ["/communities/*", "Communities", "Neighborhood coverage"],
      ["/blog/*", "Blog", "Question-title posts (~900 words samples)"],
      ["/robots.txt", "Robots", "CF Disallow vs Allow conflict"],
      ["/llms.txt", "GEO file", "404"],
      ["/sitemap.xml", "Sitemap", "200 · ~28 URLs"],
    ],
    summary:
      "Best mid/small-market local depth: services + areas + communities + blog with NC zip 27330 and HouseCleaner schema. Missing phone hurts Local Pack CTR. Cloudflare AI bot conflict and AggregateRating on only 3 reviews are the main risk flags. No llms.txt yet.",
    seoFindings: [
      ["Titles", "Clear Sanford, NC disambiguation vs FL brand", "Good"],
      ["Content system", "Areas/communities/blog — strongest topical map of mid tier", "Good"],
      ["Phone", "No tel: / phone on live pages", "Missing"],
      ["Canonical/OG", "Present; OG title slightly differs from title", "Needs Attention"],
      ["Sitemap", "Healthy ~28 URLs", "Good"],
    ],
    geoFindings: [
      ["Local entity", "PostalAddress Sanford NC 27330 + Lee County", "Good"],
      ["AggregateRating", "5.0 from 3 reviews — verify eligibility or remove", "Needs Attention"],
      ["llms.txt", "404", "Missing"],
      ["AI robots", "CF conflict", "Needs Attention"],
    ],
    aeoFindings: [
      ["Question H3s", "Homepage conversational FAQ pattern", "Good"],
      ["Blog answers", "Cost/checklist posts with question titles", "Good"],
      ["No city×service noindex trap", "Clean indexation vs Celebration", "Good"],
    ],
    priorities: [
      ["High", "Add real local phone for click-to-call / Local Pack", "SEO", "S", "Clicks/positions"],
      ["High", "Fix CF AI Disallow vs Allow; add llms.txt", "GEO", "S", "AI views"],
      ["High", "Validate or remove AggregateRating (3 reviews)", "GEO", "S", "Rich-result risk"],
      ["Medium", "Align OG title with <title>; deepen contact page", "SEO", "S", "CTR"],
      ["Quick Win", "Cross-link blog cost posts from service pages", "AEO", "S", "Clicks"],
    ],
    strengths: [
      "True local depth (areas + communities + blog)",
      "HouseCleaner schema + NC zip clarity",
      "No thin city×service noindex contradiction",
    ],
  },
  {
    id: "cleaningweekly-com",
    name: "Cleaning Weekly",
    domain: "cleaningweekly.com",
    url: "https://cleaningweekly.com",
    seo: 7, geo: 6, aeo: 8,
    baseline: "Jul 2026: SEO 5 / GEO 4 / AEO 7 — improved",
    pages: [
      ["/", "Homepage", "FAQPage + HowTo + ProfessionalService"],
      ["/guides/weekly-house-cleaning-cost-orlando/", "Guide", "~891 words; Speakable-ready"],
      ["/locations/*", "Geo matrix", "Indexable city×service ~340–360 words"],
      ["/book/", "Book", "Thin ~95 words"],
      ["/llms.txt", "GEO file", "404"],
      ["/robots.txt", "Robots", "CF Disallow vs Allow conflict"],
      ["/sitemap.xml", "Sitemap", "200 · 54 URLs"],
    ],
    summary:
      "Strongest AEO package after Sanford FL: FAQPage, HowTo, question H2s on the pricing guide, and an indexable location matrix. Still missing phone; Wikipedia sameAs dilutes brand entity; Cloudflare AI policy conflicts; only one deep guide.",
    seoFindings: [
      ["Titles/canonicals", "Solid; location URLs keyworded", "Good"],
      ["Phone", "No phone / tel:", "Missing"],
      ["sameAs", "Wikipedia Cleaning URLs — not brand socials", "Needs Attention"],
      ["/book/", "Very thin conversion page", "Needs Attention"],
      ["Location depth", "Templated but indexable; medium uniqueness", "Needs Attention"],
    ],
    geoFindings: [
      ["Schema richness", "Organization + ProfessionalService + FAQ + HowTo", "Good"],
      ["llms.txt", "404", "Missing"],
      ["AI robots", "CF conflict", "Needs Attention"],
      ["NAP", "Email only; Orlando locality", "Needs Attention"],
    ],
    aeoFindings: [
      ["FAQ UI", "details/summary (schema still present)", "Needs Attention"],
      ["Guide AEO", "Cost question H2 + Speakable-class markup", "Good"],
      ["HowTo", "Booking/how-we-work structured", "Good"],
    ],
    priorities: [
      ["High", "Add real phone; replace Wikipedia sameAs with brand profiles", "GEO", "S", "Clicks/entity"],
      ["High", "Fix CF AI policy; publish llms.txt", "GEO", "S", "AI views"],
      ["Medium", "Deepen city×service uniqueness OR consolidate thin combos", "SEO", "L", "Positions"],
      ["Medium", "Convert FAQ summary UI to visible question H3s", "AEO", "M", "Snippets"],
      ["Quick Win", "Expand /book/ past 300 words with trust + process", "SEO", "S", "Conversions"],
    ],
    strengths: [
      "Best FAQ/HowTo/Speakable stack in mid tier",
      "Healthy 54-URL sitemap with location coverage",
      "Meaningful improvement vs Jul 2026 scores",
    ],
  },
  {
    id: "celebrationcleaning-com",
    name: "Celebration Cleaning",
    domain: "celebrationcleaning.com",
    url: "https://celebrationcleaning.com",
    seo: 5, geo: 6, aeo: 6,
    baseline: "Jul 2026: SEO 5 / GEO 6 / AEO 5",
    pages: [
      ["/", "Homepage", "Phone 689-388-2588; statewide positioning"],
      ["/cleaning-services/{city}", "City hubs", "Indexable ~700 words + FAQ"],
      ["/cleaning-services/{city}/{service}", "City×service", "~126 URLs noindex but still in sitemap"],
      ["/guides/...", "Guides", "Sparse vs Sanford"],
      ["/llms.txt", "GEO file", "404"],
      ["/robots.txt", "Robots", "Clean AI Allow — best of portfolio"],
      ["/sitemap.xml", "Sitemap", "200 · ~145 URLs including noindexed combos"],
    ],
    summary:
      "Largest URL footprint with the worst indexation hygiene: ~126 city×service URLs are noindex,follow yet remain in sitemap — wasting crawl budget and confusing discovery. City hubs are decent; AI robots Allow is the cleanest in the portfolio. Phone is real (689-388-2588).",
    seoFindings: [
      ["Indexation", "noindex on city×service while listed in sitemap", "Missing"],
      ["City hubs", "Indexable and deeper with FAQ", "Good"],
      ["Phone", "Real 689-388-2588", "Good"],
      ["Contact title", "Duplicated brand suffix observed", "Needs Attention"],
      ["Guides", "Thin corpus vs Sanford/Boca", "Needs Attention"],
    ],
    geoFindings: [
      ["AI robots", "Explicit Allow GPTBot/Google-Extended — best", "Good"],
      ["llms.txt", "404", "Missing"],
      ["Address schema", "Region FL only — thin locality", "Needs Attention"],
      ["Claims", "Top-rated without strong review schema", "Needs Attention"],
    ],
    aeoFindings: [
      ["City FAQPage", "Present on hubs", "Good"],
      ["City×service", "Too thin + noindex to win snippets", "Needs Attention"],
    ],
    priorities: [
      ["Critical", "Remove noindexed city×service from sitemap OR deepen+index them", "SEO", "M", "Views/crawl"],
      ["High", "Publish llms.txt; strengthen locality in schema", "GEO", "S", "AI views"],
      ["High", "Add unique depth to any URLs kept indexable", "SEO", "L", "Positions"],
      ["Medium", "Grow guides; add review schema only if eligible", "AEO", "M", "Clicks"],
      ["Quick Win", "Fix contact title duplication", "SEO", "S", "CTR"],
    ],
    strengths: [
      "Real phone + clean AI Allow robots",
      "City hub system with FAQ potential",
      "Statewide reach positioning",
    ],
  },
  {
    id: "windermerecleaning-com",
    name: "Windermere Cleaning",
    domain: "windermerecleaning.com",
    url: "https://windermerecleaning.com",
    seo: 5, geo: 4, aeo: 6,
    baseline: "First full portfolio audit",
    pages: [
      ["/", "Homepage", "MISSING H1 — hero is H2"],
      ["/about", "About", "~146 words"],
      ["/services/*", "Services", "Most pages <250 words"],
      ["/llms.txt", "GEO file", "200 — only mid-tier with live llms"],
      ["/robots.txt", "Robots", "CF Disallow wins (no Allow override)"],
      ["/sitemap.xml", "Sitemap", "200 · 11 URLs"],
    ],
    summary:
      "Luxury positioning is clear and llms.txt exists, but on-page SEO is capped by a missing homepage H1 and thin templates. Cloudflare Managed Disallow of GPTBot/Google-Extended stands unopposed — worst AI crawl posture of sites that have content worth citing. No phone.",
    seoFindings: [
      ["Homepage H1", "Missing — H2 only", "Missing"],
      ["Titles/canonicals", "Good luxury intent", "Good"],
      ["Content depth", "Nearly all pages <250 words", "Needs Attention"],
      ["Sitemap", "Small coherent 11 URLs", "Good"],
    ],
    geoFindings: [
      ["llms.txt", "Present with Windermere FL 34786", "Good"],
      ["AI robots", "CF Disallow without site Allow override", "Missing"],
      ["Phone", "Missing", "Missing"],
      ["Schema", "HomeAndConstructionBusiness + FAQPage", "Good"],
    ],
    aeoFindings: [
      ["FAQ", "details/summary + FAQPage", "Needs Attention"],
      ["Answer depth", "Shallow vs Sanford", "Needs Attention"],
    ],
    priorities: [
      ["Critical", "Add keyword homepage H1 (Windermere + cleaning intent)", "SEO", "S", "Positions"],
      ["High", "Override CF AI Disallows if AI citations desired", "GEO", "S", "AI views"],
      ["High", "Expand service/about/service-area past 500+ words", "SEO", "M", "Positions"],
      ["Medium", "Add phone; convert FAQ to H3 questions", "AEO", "M", "Clicks/snippets"],
      ["Quick Win", "Link llms.txt from robots/footer for discoverability", "GEO", "S", "AI views"],
    ],
    strengths: [
      "Only mid-tier site with live llms.txt",
      "Clean luxury brand + coherent small sitemap",
      "Zip-level locality 34786 in schema",
    ],
  },
  {
    id: "cleaningkissimmee-com",
    name: "Cleaning Kissimmee",
    domain: "cleaningkissimmee.com",
    url: "https://cleaningkissimmee.com",
    seo: 5, geo: 3, aeo: 2,
    baseline: "First full portfolio audit",
    pages: [
      ["/", "Homepage", "~387 words; real phone (689) 288-3488"],
      ["/about", "About", "Thin ~246 words"],
      ["/services/*", "Services", "~237–261 words each"],
      ["/faq /guides", "AEO surfaces", "404"],
      ["/llms.txt", "GEO file", "404"],
      ["/robots.txt", "Robots", "CF AI bots Disallow (no override)"],
      ["/sitemap.xml", "Sitemap", "200 · 12 URLs"],
    ],
    summary:
      "Clean IA and a real phone, but near-zero AEO/GEO stack: no JSON-LD, no canonicals, no FAQ/guides, OG without image, AI bots blocked. Fastest path is cloning Sanford FL technical baseline while keeping Kissimmee vacation-rental positioning.",
    seoFindings: [
      ["Titles/meta", "Unique and local", "Good"],
      ["Canonical", "Missing", "Missing"],
      ["JSON-LD", "None", "Missing"],
      ["OG image", "Missing; OG reused", "Needs Attention"],
      ["Content depth", "Thin service pages", "Needs Attention"],
      ["Phone", "Real (689) 288-3488", "Good"],
    ],
    geoFindings: [
      ["llms.txt", "404", "Missing"],
      ["AI bots", "Blocked by CF Managed", "Missing"],
      ["E-E-A-T", "Thin about; no legal entity page depth", "Needs Attention"],
      ["Schema", "None", "Missing"],
    ],
    aeoFindings: [
      ["FAQ/guides", "404", "Missing"],
      ["Question headings", "Absent", "Missing"],
      ["Direct answers", "Absent", "Missing"],
    ],
    priorities: [
      ["Critical", "Add LocalBusiness/Service/FAQ JSON-LD + self-canonicals + OG images", "SEO", "M", "Positions"],
      ["Critical", "Ship /faq + /guides with question H3s + FAQPage", "AEO", "M", "Views/snippets"],
      ["High", "Allow AI bots + publish llms.txt", "GEO", "S", "AI views"],
      ["High", "Expand service pages 800–1200 words with inclusions/pricing/areas", "SEO", "L", "Positions"],
      ["Quick Win", "Add og:image sitewide", "SEO", "S", "Clicks/social"],
    ],
    strengths: [
      "Real phone + vacation-rental positioning for parks demand",
      "Clean service taxonomy and unique titles",
      "Small coherent sitemap ready to expand",
    ],
  },
  {
    id: "apopkacleaning-com",
    name: "Apopka Cleaning",
    domain: "apopkacleaning.com",
    url: "https://apopkacleaning.com",
    seo: 4, geo: 2, aeo: 2,
    baseline: "First full portfolio audit — weakest",
    pages: [
      ["/", "Homepage", "H1 brand-only; ~257 words"],
      ["/contact", "Contact", "Phone (407) 555-0148 placeholder"],
      ["/services/*", "Services", "~164–181 words"],
      ["/about /faq /guides", "Missing", "404"],
      ["/llms.txt", "GEO file", "404"],
      ["/robots.txt", "Robots", "CF AI bots Disallow"],
      ["/sitemap.xml", "Sitemap", "200 · 10 URLs"],
    ],
    summary:
      "Lowest portfolio scores. Placeholder phone (407) 555-0148 destroys trust and local CTR. No About, FAQ, guides, JSON-LD, OG/Twitter, or llms.txt. Homepage H1 is brand-only. Treat as priority rebuild to Windermere/Sanford baseline before content scale.",
    seoFindings: [
      ["Phone", "Placeholder (407) 555-0148", "Missing"],
      ["H1", "Brand-only 'Apopka Cleaning'", "Needs Attention"],
      ["Canonical/OG/Twitter", "Canonical missing; OG/Twitter absent", "Missing"],
      ["JSON-LD", "None", "Missing"],
      ["About", "404", "Missing"],
      ["Content", "Thinnest pages in portfolio", "Needs Attention"],
    ],
    geoFindings: [
      ["Trust", "Fake phone published live", "Missing"],
      ["llms.txt / AI bots", "404 / blocked", "Missing"],
      ["Entity", "No deep About / legal entity narrative", "Missing"],
    ],
    aeoFindings: [
      ["FAQ/guides", "404", "Missing"],
      ["Answer formats", "Absent", "Missing"],
    ],
    priorities: [
      ["Critical", "Replace (407) 555-0148 with real number everywhere", "GEO", "S", "Clicks/trust"],
      ["Critical", "Add About + FAQ + Guides; LocalBusiness schema; canonicals; OG/Twitter", "SEO", "M", "Positions"],
      ["High", "Keyword homepage H1 (house cleaning Apopka FL)", "SEO", "S", "Positions"],
      ["High", "Allow AI bots + llms.txt with real NAP", "GEO", "S", "AI views"],
      ["Medium", "Expand all service pages past 800 words", "SEO", "L", "Positions"],
    ],
    strengths: [
      "Clear service taxonomy and workable meta descriptions",
      "Small sitemap — easy to remediate quickly",
    ],
  },
];

function signalTable(rows) {
  const widths = [2200, 5160, 2000];
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        children: [
          cell("Signal", { bold: true, fill: NAVY, width: widths[0], align: AlignmentType.CENTER }),
          cell("Finding", { bold: true, fill: NAVY, width: widths[1], align: AlignmentType.CENTER }),
          cell("Status", { bold: true, fill: NAVY, width: widths[2], align: AlignmentType.CENTER }),
        ],
      }),
      ...rows.map((r, i) => {
        const statusFill = r[2] === "Good" ? GREEN : r[2] === "Missing" ? RED : AMBER;
        return new TableRow({
          children: [
            cell(r[0], { bold: true, width: widths[0], fill: i % 2 ? GRAY : undefined }),
            cell(r[1], { width: widths[1], fill: i % 2 ? GRAY : undefined, fontSize: 16 }),
            cell(r[2], { bold: true, width: widths[2], fill: statusFill, align: AlignmentType.CENTER, fontSize: 16 }),
          ],
        });
      }),
    ],
  });
}

function buildDoc(site) {
  const combined = site.seo + site.geo + site.aeo;
  const scoreBox = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [3120, 3120, 3120],
    rows: [
      new TableRow({
        children: ["SEO", "GEO", "AEO"].map((label, idx) => {
          const n = [site.seo, site.geo, site.aeo][idx];
          return new TableCell({
            width: { size: 3120, type: WidthType.DXA },
            borders: noBorders,
            shading: { type: ShadingType.CLEAR, fill: scoreColor(n) },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: label, bold: true, color: "FFFFFF", font: "Arial", size: 20 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: `${n}/10`, bold: true, color: "FFFFFF", font: "Arial", size: 56 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: scoreStatus(n), italics: true, color: "FFFFFF", font: "Arial", size: 18 })] }),
            ],
          });
        }),
      }),
    ],
  });

  const pagesTable = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [2800, 2000, 4560],
    rows: [
      new TableRow({
        children: [
          cell("URL", { bold: true, fill: NAVY, width: 2800 }),
          cell("Type", { bold: true, fill: NAVY, width: 2000 }),
          cell("Notes", { bold: true, fill: NAVY, width: 4560 }),
        ],
      }),
      ...site.pages.map((p, i) => new TableRow({
        children: [
          cell(p[0], { width: 2800, fill: i % 2 ? GRAY : undefined, fontSize: 16 }),
          cell(p[1], { width: 2000, fill: i % 2 ? GRAY : undefined, fontSize: 16 }),
          cell(p[2], { width: 4560, fill: i % 2 ? GRAY : undefined, fontSize: 16 }),
        ],
      })),
    ],
  });

  const prioTable = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [1400, 3600, 1200, 800, 2360],
    rows: [
      new TableRow({
        children: [
          cell("Priority", { bold: true, fill: NAVY, width: 1400, fontSize: 16 }),
          cell("Issue", { bold: true, fill: NAVY, width: 3600, fontSize: 16 }),
          cell("Dim", { bold: true, fill: NAVY, width: 1200, fontSize: 16 }),
          cell("Effort", { bold: true, fill: NAVY, width: 800, fontSize: 16 }),
          cell("Impact", { bold: true, fill: NAVY, width: 2360, fontSize: 16 }),
        ],
      }),
      ...site.priorities.map((p) => new TableRow({
        children: [
          cell(p[0], { bold: true, width: 1400, fill: prioColor(p[0]), fontSize: 14, align: AlignmentType.CENTER }),
          cell(p[1], { width: 3600, fontSize: 14 }),
          cell(p[2], { width: 1200, fontSize: 14, align: AlignmentType.CENTER }),
          cell(p[3], { width: 800, fontSize: 14, align: AlignmentType.CENTER }),
          cell(p[4], { width: 2360, fontSize: 14 }),
        ],
      })),
    ],
  });

  return new Document({
    styles: { default: { document: { styles: [] } } },
    sections: [
      {
        properties: {
          page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
        },
        children: [
          new Paragraph({ spacing: { before: 1600 }, children: [] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            shading: { type: ShadingType.CLEAR, fill: NAVY },
            spacing: { before: 0, after: 200 },
            children: [new TextRun({ text: site.domain, bold: true, color: "FFFFFF", font: "Arial", size: 48 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "SEO / GEO / AEO Audit Report", color: ACCENT, font: "Arial", size: 28 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [new TextRun({ text: "FULL AUDIT · 2026-09-13", color: DARK, font: "Arial", size: 20 })],
          }),
          scoreBox,
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400 },
            children: [new TextRun({ text: `Combined ${combined}/30 · ${site.name}`, color: "94A3B8", font: "Arial", size: 18 })],
          }),
          new Paragraph({ children: [new PageBreak()] }),
        ],
      },
      {
        properties: {
          page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 8 } },
                children: [
                  new TextRun({ text: site.domain, font: "Arial", size: 16, color: DARK }),
                  new TextRun({ text: "\tSEO / GEO / AEO Audit Report", font: "Arial", size: 16, color: "64748B" }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 6, color: BORDER, space: 8 } },
                children: [
                  new TextRun({ text: "Booking Broom portfolio audit · 2026-09-13", font: "Arial", size: 14, color: "94A3B8" }),
                  new TextRun({ text: "\t" }),
                  new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 14, color: "94A3B8" }),
                ],
              }),
            ],
          }),
        },
        children: [
          heading("Executive Summary"),
          new Table({
            width: { size: W, type: WidthType.DXA },
            columnWidths: [W],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: W, type: WidthType.DXA },
                    borders: thinBorders,
                    shading: { type: ShadingType.CLEAR, fill: LIGHT },
                    children: [body(site.summary)],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ spacing: { before: 200 }, children: [] }),
          new Table({
            width: { size: W, type: WidthType.DXA },
            columnWidths: [2340, 2340, 2340, 2340],
            rows: [
              new TableRow({
                children: [
                  cell("Dimension", { bold: true, fill: NAVY, width: 2340 }),
                  cell("Score", { bold: true, fill: NAVY, width: 2340 }),
                  cell("Status", { bold: true, fill: NAVY, width: 2340 }),
                  cell("Baseline", { bold: true, fill: NAVY, width: 2340 }),
                ],
              }),
              ...[
                ["SEO", site.seo],
                ["GEO", site.geo],
                ["AEO", site.aeo],
                ["Combined", combined],
              ].map(([label, n]) => new TableRow({
                children: [
                  cell(label, { bold: true, width: 2340 }),
                  cell(`${n}${label === "Combined" ? "/30" : "/10"}`, { bold: true, width: 2340, fill: label === "Combined" ? NAVY : scoreColor(n), align: AlignmentType.CENTER }),
                  cell(label === "Combined" ? "—" : scoreStatus(n), { width: 2340, align: AlignmentType.CENTER }),
                  cell(label === "SEO" ? site.baseline : "", { width: 2340, fontSize: 14 }),
                ],
              })),
            ],
          }),
          heading("Pages Audited"),
          pagesTable,
          heading("SEO Analysis"),
          body(`Score: ${site.seo}/10 — ${scoreStatus(site.seo)}`),
          signalTable(site.seoFindings),
          heading("GEO Analysis"),
          body(`Score: ${site.geo}/10 — ${scoreStatus(site.geo)}`),
          signalTable(site.geoFindings),
          heading("AEO Analysis"),
          body(`Score: ${site.aeo}/10 — ${scoreStatus(site.aeo)}`),
          signalTable(site.aeoFindings),
          heading("Priority Recommendations"),
          prioTable,
          heading("What's Working Well"),
          ...site.strengths.map((s) => bullet(s)),
          heading("Glossary"),
          body("SEO — Search Engine Optimization: rankings, crawlability, on-page relevance, and SERP CTR."),
          body("GEO — Generative Engine Optimization: visibility and accurate citation in AI answers (ChatGPT, Perplexity, Gemini, AI Overviews)."),
          body("AEO — Answer Engine Optimization: featured snippets, People Also Ask, and voice-ready direct answers."),
          new Paragraph({
            spacing: { before: 400 },
            children: [new TextRun({ text: "Limitations: HTML-level live audit. Sitemap HTTP status, robots, and page content verified 2026-09-13. Core Web Vitals, backlinks, and GSC rankings not measured in this pass.", italics: true, font: "Arial", size: 16, color: "64748B" })],
          }),
        ],
      },
    ],
  });
}

async function main() {
  for (const site of SITES) {
    const doc = buildDoc(site);
    const buf = await Packer.toBuffer(doc);
    const file = path.join(OUT, `seo-geo-aeo-full-audit-${site.id}-2026-09-13.docx`);
    fs.writeFileSync(file, buf);
    console.log("Wrote", file);
  }
  fs.writeFileSync(path.join(OUT, "_sites.json"), JSON.stringify(SITES, null, 2));
  console.log("Done", SITES.length, "reports");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
