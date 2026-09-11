# What's in the Docker image

This documents exactly what `apps/web/Dockerfile` builds and copies, and why — so you know what you're running.

## The short version

One Next.js app (`apps/web`) serves the dashboard, checkout, customer portal, invoice viewer, and REST API — they're route groups in the same app, not separate services. The Docker image ships all of those. It does **not** ship the marketing/docs content, and the install step skips dependencies nothing in the image actually imports.

## Build stages (`apps/web/Dockerfile`)

```
base    → node:20-alpine + pnpm, shared by every stage below
  ├─ deps    → installs dependencies, filtered (see below)
  ├─ builder → builds @stellartools/core, @stellartools/app-sdk,
  │            @stellartools/shared-ui, then `next build` for apps/web
  └─ runner  → the actual image: standalone server + static assets + public/
```

### `deps`: what gets installed

```
pnpm install --frozen-lockfile --filter "@stellartools/web..."
```

The `--filter "@stellartools/web..."` scopes the install to `@stellartools/web` and its actual workspace dependencies: `@stellartools/core`, `@stellartools/app-sdk`, `@stellartools/shared-ui`. Everything else in the monorepo — `apps/shopify`, `apps/marketplace-apps`, `examples/*`, and the framework adapter packages (`betterauth-adapter`, `aisdk-adapter`, `langchain-adapter`, `medusajs-adapter`, `uploadthing-adapter`, `woocommerce-adapter`) — is **not installed**. Those adapters are published to npm independently for other people's apps to `npm install`; nothing in `apps/web` imports them, so there's no reason to pull their dependencies into this image.

(In practice this doesn't shrink the install by much in absolute size — `apps/web` itself pulls in Next.js, React, Radix UI, the Stellar SDK, etc., which dominates regardless. It's still the correct thing to do: don't install what you don't use, and it does mean a `package.json` change in an unrelated adapter package can't ever invalidate this build's dependency layer.)

### `builder`: what gets built

Only the three packages `apps/web` actually imports (all consumed as compiled `dist/` output, not source):

```
pnpm -w --filter @stellartools/core run build:prod
pnpm -w --filter @stellartools/app-sdk run build
pnpm -w --filter @stellartools/shared-ui run build
pnpm --filter @stellartools/web run web:build   # next build --webpack
```

### What `next build` itself excludes: the marketing site and docs

`.dockerignore` excludes `apps/web/app/landing/docs` from the build context entirely. That's the Mintlify-powered docs site's content (`docs.json`, `*.mdx` files, images/logos — about 8MB). It's **not a Next.js route** — there's no `page.tsx`/`page.mdx` under it and no MDX loader configured in `next.config.ts` — it's pure source content for a separate Mintlify process (`pnpm dlx mintlify dev`, run only via `pnpm dev`) that Payroutes deploys independently to docs.stellartools.dev. It was never part of `next build`'s output; excluding it from the build context just avoids sending ~8MB of irrelevant files to the Docker daemon on every build.

The rest of `apps/web/app/landing` — the actual marketing pages (hero section, pricing-removed landing page, `/team`) — **is** still compiled, because it's a real part of the single Next.js route tree and `proxy.ts` routes the root path (`NEXT_PUBLIC_APP_URL`'s host) to it. Cleanly dropping it would mean either breaking that route or reworking `proxy.ts`'s fallback behavior, which isn't worth the risk for what's a small amount of code compared to the framework/dependency weight that dominates image size either way. If you want it gone from your own image, delete `apps/web/app/landing/page.tsx` and `apps/web/app/landing/team/` and adjust `proxy.ts`'s handling of the `NEXT_PUBLIC_APP_URL` case accordingly — just know you're on your own for that change, it's not something this repo maintains for you.

### `runner`: what actually ships

```
apps/web/.next/standalone/   # traced production server + only the node_modules it needs
apps/web/.next/static/       # client JS/CSS bundles
apps/web/public/             # static assets
apps/web/docker-entrypoint.sh
```

`next.config.ts` sets `output: "standalone"`, so this is Next's dependency-traced minimal server bundle — not the full `node_modules` from the `deps`/`builder` stages, and not the raw `apps/web` source tree. Only code paths actually reachable from the app's routes get traced in.

## Why there are four services, not one

`docker-compose.yml` defines `init`, `migrate`, `web`, and `cron`, all built from the same `apps/web/Dockerfile` (different targets/entrypoints) except `cron`, which needs no build at all.

| Service   | Image                          | Job                                                                 | Runs                                        |
| --------- | ------------------------------- | -------------------------------------------------------------------- | --------------------------------------------- |
| `init`    | `apps/web/Dockerfile` (runner)  | Generate missing app secrets, write to a shared volume                | Once, before `web`/`cron`                    |
| `migrate` | `apps/web/Dockerfile` (builder) | Apply pending Drizzle migrations (needs `drizzle-kit`, a dev dep — not in the slim `runner` image, hence the `builder` target) | Once, before `web` (`depends_on: service_completed_successfully`) |
| `web`     | `apps/web/Dockerfile` (runner)  | The actual app                                                        | Always                                        |
| `cron`    | plain `alpine:3.20`             | Fires the hourly subscription-renewal job against `web`               | Always                                        |

### Why `migrate` is a separate service from `web`

`drizzle-kit` is a devDependency and isn't traced into the standalone `runner` image (Next's tracing only follows what the server actually imports at runtime — a CLI tool invoked separately isn't part of that graph). Rather than bloat the runtime image with dev tooling it doesn't need, `migrate` builds only as far as the `builder` stage (which still has the full `node_modules`) and exits after running `pnpm run db:migrate`. `web` depends on it finishing successfully before it starts, so `docker compose up` still applies migrations automatically with no separate manual step.

### Why `init` exists, and why secrets live in a shared volume

`JWT_SECRET`, `MASTER_ENCRYPTION_KEY`, `ENCRYPTION_SALT`, and `CRON_SECRET` need real random values, but requiring you to generate and paste them into `apps/web/.env` before the app will even boot is bad first-run experience. `init` generates any of them that are blank (leaving anything you *did* set alone) and writes the result to the `stellartools-secrets` volume, which `web` and `cron` both mount read-only. `web`'s entrypoint sources it; `cron`'s entrypoint sources it too, specifically to know `CRON_SECRET` — since `cron` runs in a **separate container**, it has no way to see secrets `web`'s own entrypoint might otherwise have generated privately. Centralizing generation in `init` is what makes the two containers agree on the same `CRON_SECRET` without you doing anything.

This never touches `KEEPER_SECRET_*` or `SUBSCRIPTION_CONTRACT_*_ID` — those are real Stellar keys/on-chain state, and stay a deliberate manual step (see `DEVELOPMENT.md`).

### Why `cron` exists, and why it isn't Vercel Cron

In production on Vercel, subscription renewals are triggered by Vercel Cron calling `/dashboard/~api/cron/charge-subscription` on an hourly schedule — that's configured in `apps/web/vercel.json` and only works because Vercel Cron is a feature of *Vercel's own infrastructure* calling *a Vercel deployment*. It has no way to reach a container you're running yourself on your own machine or server — there's no "point Vercel Cron at an arbitrary URL" mode. So for self-hosting, something inside your own infrastructure has to trigger that endpoint instead.

`cron` is that something: a minimal `alpine` container (no image build — just the stock Alpine image plus `apps/web/docker-entrypoint.sh` bind-mounted in) that uses busybox's built-in `crond` to `wget` the endpoint hourly, authenticated with the shared `CRON_SECRET`. It depends on `init` (for the secret) and on `web` reporting healthy (so it never fires before the app can respond). No extra image, no extra dependency — it reuses the same entrypoint script as `web` and `init`, just in `cron` mode.

## Updating this doc

If you change what `.dockerignore` excludes, what the `deps`/`builder` stages install or build, or add/remove a compose service, update this file in the same change.
