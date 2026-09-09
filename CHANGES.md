# What changed — session summary

A working notes doc for reviewing this branch (`feat/oss-self-host`). Read this first; `CHANGELOG.md` has the terser, permanent version and `DOCKER.md` has the deep dive on the Docker setup specifically. Delete this file once you're done reviewing — it's not meant to stay in the repo long-term the way `CHANGELOG.md` is.

## Why

Converting StellarTools from a metered SaaS into a free tool any Stellar dev can run — either self-hosted or via the free hosted account at dashboard.stellartools.dev, but with no billing relationship either way.

## 1. Removed the platform fee, custodial wallet choice, and fiat off-ramp

- **Platform fee**: deleted `lib/pricing.ts` (`PLATFORM_FEE_BPS`), `actions/billing.ts` (the fee-settlement engine), `actions/charges.ts`, and the `charge` DB table/enums. The Soroban contract already sent 100% to the merchant on-chain for subscriptions — this removed the remaining off-chain 1% cut on one-time payments. Refunds now return the full amount (no fee to subtract).
- **Wallet strategy**: collapsed `organization.wallet_strategy` (`"managed" | "direct"`) to a single managed model. The "direct" bring-your-own-key onboarding path, its UI, and its validation are gone. Existing `"direct"` orgs in a live database keep their stored public key and keep receiving funds at the same address — nothing about their receiving address changes, they just lose an onboarding choice going forward.
- **Fiat off-ramp**: removed the SEP-24 anchor integration entirely (`integrations/anchor/`, `actions/offramp.ts`, `/api/offramp/*`, the `reconcile-offramps` cron, the payout table's fiat-only columns). Payouts are crypto-only now.
- **One DB migration** (`apps/web/db/migrations/0013_aromatic_cammi.sql`) covers all of the above schema changes.
- **Preflight checks before you deploy this against production data**: the migration file's comments call these out, but concretely —
  - `SELECT count(*) FROM payout WHERE method = 'fiat' AND status = 'pending';` should be 0 (that code path is gone).
  - Confirm the orphaned `supported_asset` table (see below) is actually empty.

### Two unrelated bugs found and fixed along the way

- `apps/web/db/migrations/0000_panoramic_skaar.sql` was a stray file with **unresolved git merge-conflict markers**, never referenced by the migration journal (only `0000_overjoyed_warpath.sql` was actually applied). Deleted.
- `supported_asset` was a DB table created in the very first migration, dropped from `schema.ts` at some point with no matching drop migration ever generated. Confirmed dead (no live code path — the "retrieve_supported_assets" MCP tool name is a coincidental string match, it returns a hardcoded value). The new migration drops it, with a comment flagging it as unrelated pre-existing drift, not part of the fee/wallet/off-ramp removal.
- `apps/web/eslint.config.mjs` had a duplicate import line that made `pnpm lint` fail outright before it could even check anything. Fixed separately from everything else since it's unrelated.

## 2. Self-hosting: Docker, one command

**Read `DOCKER.md` for the full picture.** Short version: `docker compose up` now builds the app image, starts Postgres and a local Stellar node, generates any app secrets you left blank, runs pending migrations, starts the app, and starts an hourly job for subscription renewals — no manual steps beyond `cp apps/web/.env.example apps/web/.env` and (for full functionality) a Resend API key and deploying your own subscription contract.

Four services run off the same `apps/web/Dockerfile` (different build targets/entrypoints), plus one plain-Alpine sidecar:

- **`init`** — generates `JWT_SECRET` / `MASTER_ENCRYPTION_KEY` / `ENCRYPTION_SALT` / `CRON_SECRET` if left blank, writes them to a shared Docker volume. Never touches Stellar keys or the contract ID — those stay a manual, documented step.
- **`migrate`** — applies Drizzle migrations, then exits. Built from the `builder` stage (has `drizzle-kit`, a dev dependency not in the slim runtime image).
- **`web`** — the app. Waits on `database` (healthy), `migrate` (completed), and `init` (completed) before starting.
- **`cron`** — fires `/dashboard/~api/cron/charge-subscription` hourly. **This is the fix for something you flagged**: Vercel Cron (used in production on Vercel) can only call a Vercel deployment — it has no way to reach a container you run yourself, so relying on it for self-hosting was never going to work. `cron` is the self-hosted replacement: a stock `alpine:3.20` image (no build needed) running busybox's `crond`, using the same `docker-entrypoint.sh` script as `web`/`init` in a different mode. It reads `CRON_SECRET` from the same shared volume `init` wrote to, so it and `web` agree on the token without you doing anything.

### What's actually in the image (the part you asked about directly)

- `pnpm install` in the Dockerfile is now `--filter "@stellartools/web..."` — scoped to `@stellartools/web` plus its real workspace dependencies (`core`, `app-sdk`, `shared-ui`). The other `packages/*` (framework adapters — betterauth, aisdk, langchain, medusajs, uploadthing, woocommerce) are **not installed**, since they're published to npm independently and nothing in `apps/web` imports them. Verified this is safe with `--frozen-lockfile` (tested in a scratch clone — pnpm scoped correctly to "5 of 18 workspace projects" without complaining about the lockfile).
  - Honest caveat: this doesn't shrink the install by much in absolute bytes — `apps/web`'s own dependency tree (Next.js, React, Radix, the Stellar SDK) dominates regardless. It's still correct to not install what's unused, just don't expect a dramatically smaller image from this alone.
- `apps/web/app/landing/docs` (the Mintlify docs site's source — `docs.json`, `.mdx` files, images, ~8MB) is excluded from the Docker build context via `.dockerignore`. It was never part of `next build`'s output in the first place (no `page.tsx`, no MDX loader configured) — it's source content for a separately-run/deployed Mintlify process. Excluding it just stops ~8MB of irrelevant files from being sent to the Docker daemon.
- `examples/*`, `apps/shopify`, `apps/marketplace-apps` are **still in the build context** (not deleted or dockerignored) — I looked at removing them too, but doing that safely would mean either deleting them from the actual build context (risky: `pnpm install --frozen-lockfile` validates the on-disk workspace against the lockfile, and I wasn't able to fully verify that removing workspace-member directories outright doesn't break that check) or filtering them out of `pnpm-workspace.yaml`'s globs (a bigger, riskier structural change). The `--filter` install already means their *dependencies* aren't installed; what's left is just their raw source sitting in an intermediate build layer, which never reaches the final runtime image anyway (only `.next/standalone` + `.next/static` + `public` get copied into the `runner` stage). Net effect: this doesn't cost you anything in the shipped image, only in build-context transfer time, which is a smaller and lower-risk thing to leave as a known tradeoff.
- The actual marketing/landing pages (`apps/web/app/landing/page.tsx`, `/team`) **are still compiled and shipped** — I chose not to delete these. Reasoning: it's one Next.js app with one route tree, and `proxy.ts` routes the root path to `/landing` based on the `NEXT_PUBLIC_APP_URL` host. Deleting the route without also reworking `proxy.ts`'s fallback would leave the root path (and the healthcheck, which I had to re-point at `/dashboard` specifically for this reason) broken. It's also small compared to the framework dependency weight that dominates image size regardless. `DOCKER.md` documents exactly how to remove it yourself if you want to, and what you'd need to touch (`proxy.ts`) to do it cleanly.

### Postgres — yes, it's provisioned

`docker-compose.yml`'s `database` service (`postgres:15`, with a healthcheck, a named volume for persistence, and `seed.sql` mounted for first-boot init) has been there since the first Docker pass in this session — it's not something separate you need to stand up. `web` and `migrate` both point at it via `DATABASE_URL: postgresql://postgres:local@database:5432/postgres` (overriding whatever's in `apps/web/.env`, which only matters for non-Docker `pnpm dev`, where it connects via the exposed host port `5436` instead).

### Not verified end-to-end

No Docker daemon or Rust toolchain was available in the environment this was built in. `docker compose config` validates the merged compose file cleanly (structure, service graph, env resolution), and the pnpm `--filter --frozen-lockfile` install was tested for real in a scratch clone — but the actual `docker compose up` build-and-boot sequence, the `cron` container's `crond` behavior, and the Soroban contract build (`make build` in `apps/web/soroban/`, untouched code, so low risk) are unverified. Please run it for real before relying on it.

## 3. Organization onboarding simplified

Removed the post-signup "book a call" step (a Cal.com embed shown after creating an organization, with a "Skip, go to dashboard" button). Creating an organization now goes straight to the dashboard — no intermediate modal step, no `@calcom/embed-react` dependency (removed from `package.json`, lockfile updated). The marketing site's separate "Book a demo" nav link (a different Cal.com usage, in `components/navbar.tsx`) was left alone — it wasn't part of onboarding and you didn't ask about it.

## 4. Docs

- Rewrote `README.md`, `DEVELOPMENT.md` around the public-good framing.
- Added `CONTRIBUTING.md`, `SECURITY.md`, `ROADMAP.md`, `CHANGELOG.md`, `DOCKER.md` at the repo root.
- Added a "Self-Hosting" section to the Mintlify docs site (`apps/web/app/landing/docs/self-hosting/{quickstart,configuration}.mdx`), registered in `docs.json`, linked from the docs homepage.
- Added `.github/workflows/ci.yml` (type-check + test on PRs; lint isn't wired in yet — the existing codebase has a backlog of ~65 pre-existing lint findings unrelated to this work, called out in `ROADMAP.md` instead of bundled in here) and `.github/workflows/docker-publish.yml` (builds and pushes the image to `ghcr.io/<repo>:latest` on every push to `main`).
- **Correction mid-session**: I initially wrote the docs/README as if self-hosting were the *only* way to use StellarTools. That was wrong — there are two ways (the free hosted account at dashboard.stellartools.dev, or self-hosting) — and I went back through and fixed every place that implied otherwise (`README.md`, `DEVELOPMENT.md`, `ROADMAP.md`, `CHANGELOG.md`, the docs homepage, and I'd made some over-broad edits to `webhooks.mdx`/`authentication.mdx`/`mcp.mdx`/`woocommerce.mdx` that I reverted back to their original `dashboard.stellartools.dev` references, since those pages are for anyone using the product, not specifically self-hosters).

## Commits on this branch so far

```
ee857c25 refactor: remove platform fee, custodial wallet choice, and fiat off-ramp
58df12c3 fix: remove duplicate import in eslint.config.mjs
881079da feat: first-class Docker self-hosting
ad0444c6 docs: public-good README, self-hosting guide, CONTRIBUTING/SECURITY/ROADMAP/CHANGELOG, CI
2535f9af feat: Supabase-style one-command self-hosting, docs, and image publishing
```

Plus the uncommitted work covered in sections 2–4 above (Docker architecture rework, onboarding simplification, doc corrections) — not yet committed as of writing this file.

## What I'd want you to double-check

1. **The Docker build, for real.** `docker compose up` on a machine with Docker actually running — this is the single biggest unverified piece.
2. **The preflight checks** in section 1 against your actual production database before merging/deploying this.
3. **Whether dropping the marketing `/landing` pages from the self-hosted image is worth doing properly** (would need a `proxy.ts` change) — I left it in for now; see the tradeoff writeup above.
4. **The `ghcr.io/payrouteshq/stellartools` image path** referenced in the docs — your git remote is `usepaykit/stellartools` (GitHub says it "moved" to `payrouteshq/stellartools`, redirects work), and the actual publish workflow uses `${{ github.repository }}` dynamically so it's always correct regardless — just flagging that the doc references assume the `payrouteshq` org name.
