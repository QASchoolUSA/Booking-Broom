<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

This app has two services that must both run for local development: a **Convex backend** and the **Next.js dev server**. `npm install` is handled by the startup update script.

### Convex without a cloud account (required in Cloud)
The README assumes a Convex cloud login. In this environment there is no account, so run Convex as an **anonymous local backend** by setting `CONVEX_AGENT_MODE=anonymous` on every `convex` command. This spins up a local backend on `http://127.0.0.1:3210` and its dashboard/HTTP actions on `3211`.

`convex dev` writes `.env.local` (`NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `CONVEX_DEPLOYMENT`). `.env.local` is gitignored, so if it is missing on a fresh machine, regenerate it by starting Convex once. The anonymous deployment data persists on disk between runs (it will say "existing" instead of re-seeding).

### First-time startup sequence (run in order)
1. Start the Convex backend (keep it running; it hot-reloads `convex/` on save):
   `CONVEX_AGENT_MODE=anonymous npx convex dev`
2. Only needed once per deployment — set auth JWT keys (otherwise sign-up fails with `Missing JWT_PRIVATE_KEY`). Must include the env var so it targets the anonymous deployment:
   `CONVEX_AGENT_MODE=anonymous node scripts/setup-convex-auth.mjs http://localhost:3000`
3. Only needed once — seed the cleaning sites (safe to re-run; it no-ops if sites exist):
   `CONVEX_AGENT_MODE=anonymous npx convex run internal.seed.seedSites`
4. In a separate terminal start Next.js (`npm run dev` → runs on `http://localhost:3000`, uses `--webpack`; Serwist PWA is disabled in dev).

Gotcha: any `convex run` / `convex env` / `convex deploy` command also needs `CONVEX_AGENT_MODE=anonymous`, or it will try to reach Convex cloud and fail.

### Verifying the app
- All routes except `/login` and `/api/bookings` require auth; unauthenticated requests 307-redirect to `/login`. Create a manager account at `/login` via "First time? Create manager account".
- Simulate an inbound booking without the UI: `POST http://localhost:3000/api/bookings` with a seeded site (e.g. `{"site_slug":"sanford","api_key":"bb_sanford_dev_key","customer_name":"Jane Doe","service_type":"Deep Clean"}`). Bookings appear on the dashboard in real time.
- PageSpeed Insights lives at `/performance` (nav label **Speed**). Set `PAGESPEED_API_KEY` in Convex env, then use **Sync now** to audit each site.

### Lint
`npm run lint` runs but currently reports pre-existing errors (mostly `react-hooks` purity/set-state rules); these are not caused by environment setup.
