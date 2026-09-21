#!/usr/bin/env node
/**
 * Bare `convex deploy` targets Convex Prod by default, but Booking Broom
 * uses only Dev (dynamic-gnu-491). Prefer convex:dev locally; use
 * convex:ci-deploy in CI with a Dev-scoped CONVEX_DEPLOY_KEY.
 */
console.error(`
Booking Broom uses a single Convex Dev backend (dynamic-gnu-491).

  Local push:  pnpm convex:dev
               (or: pnpm exec convex dev --once)

  CI / Cloudflare: set CONVEX_DEPLOY_KEY to a Dev key
               (dev:dynamic-gnu-491|…) then:
               pnpm convex:ci-deploy --cmd 'pnpm run build'

Do not use a prod:… deploy key — the Worker already talks to Dev.
`);
process.exit(1);
