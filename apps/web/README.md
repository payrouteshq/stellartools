# @stellartools/web

The main Next.js application — dashboard, customer portal, checkout pages, and marketing site.

## Development

```bash
# From repo root (recommended)
pnpm dev              # Next.js on :3000 + Mintlify docs on :3333 (concurrently)
pnpm build            # production build (also builds @stellartools/core)
pnpm start            # serve the production build
pnpm lint             # ESLint
pnpm type-check       # tsc --noEmit

# Database
pnpm db:generate      # drizzle-kit generate
pnpm db:migrate       # drizzle-kit migrate

# Or run directly in this directory
cd apps/web
pnpm dev
```

## Environment

Copy `.env.example` to `.env.local` and fill in the required variables (database URL, Stellar keys, auth secrets, etc.).

## Structure

```
apps/web/
├── app/              # Next.js App Router routes
│   ├── dashboard/    # authenticated dashboard
│   ├── checkout/     # hosted checkout pages
│   ├── portal/       # customer self-serve portal
│   └── landing/      # marketing site + docs
├── actions/          # Next.js Server Actions
├── components/       # app-specific components (no Storybook stories)
├── db/               # Drizzle schema + migrations
├── hooks/            # app-specific hooks
├── lib/              # utilities, validators, action-handler
├── integrations/     # third-party service adapters
├── providers/        # React context providers
└── emails/           # React Email templates
```

## Shared UI

UI components with Storybook stories live in `@stellartools/shared-ui` (see `packages/shared-ui`). Import them as:

```tsx
import { Button, DataTable, TextField } from "@stellartools/shared-ui";
```
