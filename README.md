<p align="center">
  <img src="./public/images/logo-dark.svg#gh-dark-mode-only" width="180" alt="Stellar Tools" />
  <img src="./public/images/logo-light.svg#gh-light-mode-only" width="180" alt="Stellar Tools" />
</p>

<p align="center">
  Payment infrastructure built on the Stellar blockchain.
</p>

<p align="center">
  <a href="https://stellartools.dev">Website</a> &bull;
  <a href="https://docs.stellartools.dev">Docs</a> &bull;
  <a href="DEVELOPMENT.md">Development</a>
</p>

---

## What is Stellar Tools?

Stellar Tools is an open-source payment platform that lets developers accept and manage payments using the Stellar network. It handles subscriptions, checkouts, webhooks, customer management, and payouts, with smart contract support via Soroban.

- Accept payments in Stellar-native assets
- Manage subscriptions with metered billing via Soroban smart contracts
- Hosted checkout pages and customer portals
- Webhook delivery for payment and subscription events
- Dashboard for managing customers, products, and payouts
- Marketplace for integrations

## Tech Stack

- [Next.js](https://nextjs.org) 16 + [React](https://react.dev) 19 - framework
- [TypeScript](https://typescriptlang.org) - language
- [Tailwind CSS](https://tailwindcss.com) 4 - styling
- [PostgreSQL](https://www.postgresql.org) + [Drizzle ORM](https://orm.drizzle.team) - database
- [Stellar SDK](https://stellar.org) + [Soroban](https://soroban.stellar.org) - blockchain
- [pnpm](https://pnpm.io) workspaces + [Nx](https://nx.dev) - monorepo

## Monorepo Structure

```
stellar-tools/
├── apps/
│   └── web/          # Next.js dashboard + marketing site (@stellartools/web)
└── packages/
    ├── shared-ui/    # Shared React component library (@stellartools/shared-ui)
    ├── stellartools/ # Core SDK (@stellartools/core)
    ├── plugin-sdk/   # Plugin SDK (@stellartools/plugin-sdk)
    ├── aisdk-adapter/
    ├── app-embed-bridge/
    ├── betterauth-adapter/
    ├── langchain-adapter/
    ├── medusajs-adapter/
    ├── uploadthing-adapter/
    └── wordpress-adapter/
```

## Getting Started

```bash
pnpm install          # install all workspace deps
pnpm dev              # start the Next.js app (port 3000)
pnpm storybook        # start Storybook (port 6006)
pnpm build            # production build
pnpm build:packages   # build all publishable packages
pnpm type-check       # run tsc across the workspace
```

## Packages

| Package                             | Description                                         |
| ----------------------------------- | --------------------------------------------------- |
| `@stellartools/shared-ui`           | Shared React component library with Storybook       |
| `@stellartools/core`                | Core SDK for interacting with the Stellar Tools API |
| `@stellartools/plugin-sdk`          | Build metered integrations on top of Stellar Tools  |
| `@stellartools/betterauth-adapter`  | BetterAuth integration                              |
| `@stellartools/aisdk-adapter`       | Vercel AI SDK integration                           |
| `@stellartools/medusajs-adapter`    | MedusaJS integration                                |
| `@stellartools/uploadthing-adapter` | UploadThing integration                             |
| `@stellartools/app-embed-bridge`    | Bridge for embedded app iframes                     |
| `langchain-adapter`                 | LangChain integration                               |

## Contributing

See [DEVELOPMENT.md](DEVELOPMENT.md) to get your local environment set up.

Found a bug? [Open an issue](https://github.com/payrouteshq/stellartools/issues).

## Security

If you discover a security vulnerability within StellarTools, please send an email to odii@stellartools.dev.

All reports will be promptly addressed, and you'll be credited accordingly.

## Maintained by

[Emmanuel Odii](https://github.com/devodii)

## License

MIT License. Copyright 2025 PayKit.
