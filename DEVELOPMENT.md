# Development & Self-Hosting

This guide covers everything you need to run Stellar Tools yourself — locally for development, or as a self-hosted deployment. There is no hosted SaaS version; running your own instance is the primary way to use this project.

## Prerequisites

- [Node.js](https://nodejs.org) v20+
- [pnpm](https://pnpm.io) v9+
- [Docker](https://docker.com) (for PostgreSQL, a local Stellar node, and — for self-hosting — the app itself)
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli/install-cli) (to deploy the subscription contract)

## 1. Clone and install

```bash
git clone https://github.com/payrouteshq/stellartools.git
cd stellartools
pnpm install
```

## 2. Configure environment variables

```bash
cp apps/web/.env.example apps/web/.env
```

Fill in `apps/web/.env`. The variables you need to get started locally:

| Variable                    | Description                                             |
| ---------------------------- | -------------------------------------------------------- |
| `DATABASE_URL`               | PostgreSQL connection string                              |
| `JWT_SECRET`                 | Secret for signing session JWTs                           |
| `MASTER_ENCRYPTION_KEY`      | Encrypts organization secret keys at rest                 |
| `ENCRYPTION_SALT`            | Salt used alongside `MASTER_ENCRYPTION_KEY`                |
| `RESEND_API_KEY`             | Resend API key for transactional email                    |
| `NEXT_PUBLIC_APP_URL`        | URL of the landing page (e.g. `http://localhost:3000`)    |
| `NEXT_PUBLIC_DASHBOARD_URL`  | URL of the dashboard                                       |
| `NEXT_PUBLIC_API_URL`        | URL of the API                                             |

The Stellar-specific variables (`NEXT_PUBLIC_RPC_URL_TESTNET`, `KEEPER_SECRET_TESTNET`, `SUBSCRIPTION_CONTRACT_TESTNET_ID`, etc.) are covered in step 4 below — you'll fill them in once the contract is deployed.

## 3. Start Postgres and a local Stellar node

```bash
docker compose up -d database quickstart
```

This starts PostgreSQL (port 5436) and a standalone Stellar node with Soroban RPC (port 8000). If you'd rather point at public testnet/mainnet RPC + Horizon endpoints instead of running your own node, skip `quickstart` and set `NEXT_PUBLIC_RPC_URL_TESTNET` / `NEXT_PUBLIC_STELLAR_HORIZON_TESTNET` to public endpoints in `apps/web/.env`.

Run migrations:

```bash
pnpm --filter @stellartools/web db:migrate
```

## 4. Deploy the subscription contract

Subscriptions are enforced on-chain by the `subscription-engine` Soroban contract — you deploy your own copy, you own it, and nobody but you can touch it.

```bash
cd apps/web/soroban
make release
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/subscription_engine.wasm \
  --source <your-funded-key> \
  --network testnet
```

The deploying account must be funded on testnet (use [Friendbot](https://friendbot.stellar.org)). The command prints the deployed contract ID — set it as `SUBSCRIPTION_CONTRACT_TESTNET_ID` in `apps/web/.env`. Repeat with `--network mainnet` (and a mainnet-funded key) when you're ready to go live, setting `SUBSCRIPTION_CONTRACT_MAINNET_ID`.

You also need a small "keeper" account that pays the (fractions-of-a-cent) Stellar network fee for contract calls — generate a keypair, fund it with a little XLM, and set `KEEPER_SECRET_TESTNET` / `KEEPER_SECRET_MAINNET`. This account is entirely yours; nothing about this project takes a cut of it or of anything you process.

## 5. Run it

**Local development:**

```bash
pnpm -C packages/stellartools build:dev
pnpm dev
```

| Service           | URL                    |
| ------------------ | ---------------------- |
| Web app (Next.js)  | http://localhost:3000  |
| Docs (Mintlify)    | http://localhost:3333  |

**Self-hosted (Docker), instead of step 5's dev server:**

```bash
docker compose up -d --build web
```

This builds and runs the app in a container alongside `database` (and `quickstart`, if you're using it), reading its configuration from `apps/web/.env`. The image is production-ready — same build used for `pnpm start`.

To expose your instance publicly, either put it behind your own reverse proxy/TLS, or use the bundled optional Cloudflare Tunnel service:

```bash
# apps/web/.env: set CLOUDFLARE_TUNNEL_TOKEN
docker compose --profile tunnel up -d
```

## Recurring subscription billing outside Vercel

In production on Vercel, subscription renewals are triggered by a Vercel Cron hitting `/dashboard/~api/cron/charge-subscription` hourly (see `apps/web/vercel.json`). Self-hosting elsewhere, trigger the same endpoint yourself on a schedule — a host cron job, systemd timer, or a scheduler container all work:

```bash
curl -X POST https://your-domain.com/dashboard/~api/cron/charge-subscription \
  -H "Authorization: Bearer $CRON_SECRET"
```

Run it hourly. `CRON_SECRET` must match the value set in `apps/web/.env`.

## Running tests

```bash
pnpm --filter @stellartools/web test
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the PR process and code style.
