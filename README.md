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
- [pnpm](https://pnpm.io) - package manager

## Packages

| Package                             | Description                                         |
| ----------------------------------- | --------------------------------------------------- |
| `@stellartools/core`                | Core SDK for interacting with the Stellar Tools API |
| `@stellartools/plugin-sdk`          | Build metered integrations on top of Stellar Tools  |
| `@stellartools/betterauth-adapter`  | BetterAuth integration                              |
| `@stellartools/aisdk-adapter`       | Vercel AI SDK integration                           |
| `@stellartools/medusajs-adapter`    | MedusaJS integration                                |
| `@stellartools/uploadthing-adapter` | UploadThing integration                             |
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
