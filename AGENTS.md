<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

This app has two services that must both run for local development: a **Convex backend** and the **Next.js dev server**. `pnpm install` is handled by the startup update script.

### Convex without a cloud account (required in Cloud)
The README assumes a Convex cloud login. In this environment there is no account, so run Convex as an **anonymous local backend** by setting `CONVEX_AGENT_MODE=anonymous` on every `convex` command. This spins up a local backend on `http://127.0.0.1:3210` and its dashboard/HTTP actions on `3211`.

`convex dev` writes `.env.local` (`NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `CONVEX_DEPLOYMENT`). `.env.local` is gitignored, so if it is missing on a fresh machine, regenerate it by starting Convex once. The anonymous deployment data persists on disk between runs (it will say "existing" instead of re-seeding).

### First-time startup sequence (run in order)
1. Start the Convex backend (keep it running; it hot-reloads `convex/` on save):
   `CONVEX_AGENT_MODE=anonymous pnpm exec convex dev`
2. Only needed once per deployment — set auth JWT keys (otherwise sign-up fails with `Missing JWT_PRIVATE_KEY`). Must include the env var so it targets the anonymous deployment:
   `CONVEX_AGENT_MODE=anonymous node scripts/setup-convex-auth.mjs http://localhost:3000`
3. Only needed once — seed the cleaning sites (safe to re-run; it no-ops if sites exist):
   `CONVEX_AGENT_MODE=anonymous pnpm exec convex run internal.seed.seedSites`
4. In a separate terminal start Next.js (`pnpm dev` → runs on `http://localhost:3000`, uses `--webpack`; Serwist PWA is disabled in dev).

Gotcha: any `convex run` / `convex env` / `convex deploy` command also needs `CONVEX_AGENT_MODE=anonymous`, or it will try to reach Convex cloud and fail.

### Verifying the app
- All routes except `/login` and `/api/bookings` require auth; unauthenticated requests 307-redirect to `/login`. Create a manager account at `/login` via "First time? Create manager account".
- Simulate an inbound booking without the UI: `POST http://localhost:3000/api/bookings` with a seeded site (e.g. `{"site_slug":"sanford","api_key":"bb_sanford_dev_key","customer_name":"Jane Doe","service_type":"Deep Clean"}`). Bookings appear on the dashboard in real time.
- Booking confirmation emails send from each site’s connected SpaceMail mailbox (Email → Connect). Set `EMAIL_CREDENTIALS_KEY` in Convex env (32-byte secret). Optional fallback when a site isn’t connected: also set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (and optionally `SMTP_PORT` / `SMTP_FROM`) in Convex env. Do **not** set SMTP on Cloudflare Workers.
- Web push for new bookings: managers opt in on **Settings**. Set Convex env `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (e.g. `mailto:you@example.com`). Generate keys with `npx web-push generate-vapid-keys`. Serwist (and thus push) is **disabled in `next dev`** — test with `pnpm preview` / the deployed PWA. iOS requires Add to Home Screen.
- Telegram alerts for every public quote/book: set Convex env `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. Scheduled asynchronously from `bookings.createPublic` (same pattern as email/SMS/push) — marketing sites do not wait on Telegram. Missing env or send failures are logged and ignored.
- Telegram alerts for every public quote/book: set Convex env `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. Scheduled asynchronously from `bookings.createPublic` (same pattern as email/SMS/push) — marketing sites do not wait on Telegram. Missing env or send failures are logged and ignored.
- PageSpeed Insights lives at `/performance` (nav label **Speed**). Set `PAGESPEED_API_KEY` in Convex env, then use **Sync now** to audit each site.
- SEO lives at `/seo` with a Google / Bing toggle. Google uses OAuth (`GOOGLE_CLIENT_*`); Bing uses `BING_WEBMASTER_API_KEY`. Page scans run from the SEO site cards.

### Production (Cloudflare Workers)
Deployed via `@opennextjs/cloudflare`. `pnpm run build` is OpenNext; `pnpm run build:next` is a plain Next.js webpack build (required for Serwist).

Cloudflare Workers Builds should run `pnpm exec convex deploy --cmd 'pnpm run build'`, then `npx wrangler deploy` / `pnpm exec wrangler deploy` with committed `wrangler.jsonc`. Set `CONVEX_DEPLOY_KEY` as a **build secret**. Public `NEXT_PUBLIC_CONVEX_*` / `NEXT_PUBLIC_APP_URL` are in `wrangler.jsonc` `vars` and must also be present at build time.

Keep `src/middleware.ts` named `middleware.ts` (OpenNext does not support Next 16 `proxy.ts` yet). Do not re-run `scripts/setup-convex-auth.mjs` against production unless `SITE_URL` changes.

### Lint
`pnpm lint` runs but currently reports pre-existing errors (mostly `react-hooks` purity/set-state rules); these are not caused by environment setup.
