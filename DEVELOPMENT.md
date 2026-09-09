# Development & Self-Hosting

You can use Stellar Tools two ways: a free hosted account at [dashboard.stellartools.dev](https://dashboard.stellartools.dev), or self-hosted — running your own instance, with your own database and Stellar keys. This guide covers the self-hosted path, plus local development on this repo. For a narrower quickstart and production notes, see the [self-hosting docs](https://docs.stellartools.dev/self-hosting/quickstart).

## Prerequisites

- [Docker](https://docker.com) and Docker Compose v2 — this is the only hard requirement to self-host
- [Node.js](https://nodejs.org) v20+ and [pnpm](https://pnpm.io) v9+ — only needed for local development without Docker
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli/install-cli) — only needed to deploy the subscription contract (step 3)

## 1. Clone and configure

```bash
git clone https://github.com/payrouteshq/stellartools.git
cd stellartools
cp apps/web/.env.example apps/web/.env
```

The defaults in `apps/web/.env` are set up to work out of the box on `localhost` — you don't need to fill anything in yet to try it. Two things you'll want before real use:

- `RESEND_API_KEY` — required for account signup/login (StellarTools emails a one-time code). Get a free key at [resend.com](https://resend.com/api-keys).
- `JWT_SECRET`, `MASTER_ENCRYPTION_KEY`, `ENCRYPTION_SALT`, `CRON_SECRET` — leave these blank for Docker; the `init` service generates and persists random values for them on first run (see `apps/web/docker-entrypoint.sh` and [DOCKER.md](DOCKER.md)). Set them explicitly here instead if you're running `pnpm dev` directly, or before anything beyond a local trial.

## 2. Start everything

```bash
docker compose up -d
```

This single command builds the app image; starts PostgreSQL and a local Stellar node with Soroban RPC; generates any missing app secrets; **runs pending database migrations automatically**; starts the web app; and starts an hourly cron job for subscription renewals — in dependency order, so nothing races. First run takes a few minutes to build; after that, `docker compose up -d` is seconds. See [DOCKER.md](DOCKER.md) for exactly what each service does and why.

Once it's up:

| Surface   | URL                              |
| --------- | --------------------------------- |
| Landing   | http://localhost:3000             |
| Dashboard | http://dashboard.localhost:3000   |
| Checkout  | http://checkout.localhost:3000    |
| Portal    | http://portal.localhost:3000      |
| API       | http://api.localhost:3000         |

Most browsers and OSes resolve `*.localhost` to `127.0.0.1` automatically (it's reserved for this in [RFC 6761](https://www.rfc-editor.org/rfc/rfc6761)). If yours doesn't, add the subdomains you need to `/etc/hosts`:

```
127.0.0.1 dashboard.localhost checkout.localhost portal.localhost api.localhost invoice.localhost
```

To update after pulling new changes: `docker compose up -d --build`.

## 3. Deploy the subscription contract

This is the one step that can't be automated for you — it's a real on-chain transaction that makes you the owner of your own contract instance. Everything else in the app works without it; you only need this for subscription features.

```bash
cd apps/web/soroban
make release
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/subscription_engine.wasm \
  --source <your-funded-key> \
  --network testnet
```

The deploying account must be funded on testnet (use [Friendbot](https://friendbot.stellar.org)). The command prints the deployed contract ID — set it as `SUBSCRIPTION_CONTRACT_TESTNET_ID` in `apps/web/.env`, then `docker compose up -d web` to pick it up. Repeat with `--network mainnet` (and a mainnet-funded key) when you're ready to go live, setting `SUBSCRIPTION_CONTRACT_MAINNET_ID`.

You also need a small "keeper" account that pays the (fractions-of-a-cent) Stellar network fee for contract calls — generate a keypair, fund it with a little XLM, and set `KEEPER_SECRET_TESTNET` / `KEEPER_SECRET_MAINNET`. This account is entirely yours; nothing about this project takes a cut of it or of anything you process.

## Going to production

- Put the `web` service behind your own reverse proxy with TLS (Caddy, Traefik, nginx), or use the bundled optional Cloudflare Tunnel: set `CLOUDFLARE_TUNNEL_TOKEN` in `apps/web/.env`, then `docker compose --profile tunnel up -d`.
- Point the `NEXT_PUBLIC_*_URL` variables and `COOKIE_DOMAIN` at your real domain instead of `*.localhost`.
- Set `JWT_SECRET`, `MASTER_ENCRYPTION_KEY`, `ENCRYPTION_SALT`, and `CRON_SECRET` explicitly rather than relying on the auto-generated ones.
- Use a managed/backed-up Postgres instead of the bundled `database` container, or make sure the `stellartools-database-data` volume is backed up.
- Prebuilt images are also published to `ghcr.io/payrouteshq/stellartools` on every push to `main`, if you'd rather pull than build (see `.github/workflows/docker-publish.yml`).

### Recurring subscription billing

In production on Vercel, subscription renewals are triggered by a Vercel Cron hitting `/dashboard/~api/cron/charge-subscription` hourly (see `apps/web/vercel.json`) — that only works because Vercel Cron calls a Vercel deployment; it has no way to reach a container you're running yourself. `docker-compose.yml` includes a `cron` service that does the equivalent for self-hosting: it calls that same endpoint hourly, authenticated with `CRON_SECRET`. It's part of `docker compose up` — no separate setup. See [DOCKER.md](DOCKER.md) for how it works.

If you're deploying without Docker Compose at all (e.g. a custom orchestration setup), trigger the endpoint yourself on a schedule instead:

```bash
curl -X POST https://your-domain.com/dashboard/~api/cron/charge-subscription \
  -H "Authorization: Bearer $CRON_SECRET"
```

Run it hourly. `CRON_SECRET` must match the value set (or auto-generated) in `apps/web/.env`.

## Developing without Docker

```bash
pnpm install
docker compose up -d database quickstart   # just Postgres + the local Stellar node
pnpm --filter @stellartools/web db:migrate
pnpm -C packages/stellartools build:dev
pnpm dev
```

| Service            | URL                    |
| ------------------- | ---------------------- |
| Web app (Next.js)   | http://localhost:3000  |
| Docs (Mintlify)     | http://localhost:3333  |

## Running tests

```bash
pnpm --filter @stellartools/web test
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the PR process and code style.
