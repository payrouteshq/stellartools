# Stellar Payments (Shopify)

## Prerequisites

- Node 18+
- pnpm
- Docker (for Postgres)
- Shopify Partners app linked to this project

## First-time setup

From the repo root, start Postgres:

```
docker compose up database -d
```

Copy env and fill in your app credentials:

```
cp .env.example .env
```

Link the app (once):

```
pnpm exec shopify app config link
```

Apply the database schema if the tables do not exist yet:

```
psql postgresql://postgres:local@localhost:5436/shopify_app -f db/schema.sql
```

## Start dev

```
cd apps/shopify
pnpm dev
```

Leave `SHOPIFY_APP_URL` empty in `.env`. The CLI sets the tunnel URL automatically each session.

Press `p` in the dev terminal to open the app preview, or open the app from your dev store admin.

## If the app URL looks stale

Stop dev, then:

```
pnpm exec shopify app dev clean
pnpm dev
```

Use a fresh browser tab when reinstalling or re-opening the app.
