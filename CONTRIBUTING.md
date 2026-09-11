# Contributing

Thanks for considering a contribution to Stellar Tools. This is a free, self-hosted project — every improvement here benefits everyone running their own instance, not a single hosted product.

## Getting your environment running

See [DEVELOPMENT.md](DEVELOPMENT.md) for the full local setup (env vars, Postgres, the local Stellar node, and deploying the subscription contract) and the Docker self-hosting path.

## Before you open a PR

- Keep changes focused — a bug fix shouldn't carry an unrelated refactor along with it.
- Run the checks the CI will run:
  ```bash
  pnpm type-check
  pnpm lint
  pnpm --filter @stellartools/web test
  ```
- If your change touches `apps/web/db/schema.ts`, generate a migration and commit it:
  ```bash
  pnpm --filter @stellartools/web db:generate
  ```
  Review the generated SQL before committing — check it does what you expect, especially for anything that drops or alters existing columns.
- If your change touches `apps/web/soroban/subscription-engine`, confirm it still builds:
  ```bash
  cd apps/web/soroban && make build
  ```
- Match the existing code style. Formatting is enforced by Prettier (`pnpm format`) and linting by ESLint (`pnpm lint`) — no need to hand-format.
- Don't add comments that just restate what the code does; only comment on the non-obvious *why*.

## Opening a PR

- Describe what changed and why, not just what the diff shows.
- Link any related issue.
- If the change is user-facing (dashboard, API, checkout, or anything a self-hoster would notice), add an entry to [CHANGELOG.md](CHANGELOG.md) under `Unreleased`.
- Expect review before merge — this keeps the project trustworthy for everyone running it in production with real funds.

## Reporting bugs and proposing features

Open a [GitHub issue](https://github.com/payrouteshq/stellartools/issues). For anything involving a security vulnerability, see [SECURITY.md](SECURITY.md) instead — don't open a public issue for those.

## Package changes

Reusable packages under `packages/*` (the core SDK, framework adapters) are versioned with [Changesets](https://github.com/changesets/changesets). If your change affects one of them, run:

```bash
pnpm changeset
```

and follow the prompts. This is what generates each package's own `CHANGELOG.md` on release.
