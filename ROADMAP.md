# Roadmap

This is a living list of where the project is headed, not a set of promises with dates attached. Priorities shift based on what self-hosters actually run into — the best way to influence it is to [open an issue](https://github.com/payrouteshq/stellartools/issues) or start a discussion.

## Now

- **Self-hosting hardening.** The Docker path (`docker-compose.yml`, `apps/web/Dockerfile`) is new — expect rough edges as more people run it on real infrastructure. Reports of what breaks are the highest-value contribution right now.
- **CI coverage.** Type-checking and tests run in CI; lint isn't wired in yet because the existing codebase has a backlog of pre-existing lint findings to clear first. Getting `pnpm lint` fully clean and added to CI is a near-term goal.
- **Wallet coverage.** Checkout uses [Stellar Wallets Kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit), so wallet support broadly tracks what the kit supports. Gaps reported against specific wallets are welcome.

## Later

- Expanding the marketplace app ecosystem (see `apps/marketplace-apps/`) beyond the current integrations
- More framework adapters alongside the existing BetterAuth, AI SDK, MedusaJS, WooCommerce, LangChain, and UploadThing ones
- Deeper Soroban contract test coverage for `subscription-engine`

## Explicitly not planned

- **No hosted SaaS.** This project is self-hosted only — there's no plan to reintroduce a managed offering, billing, or a platform fee.
- **No custodial wallet mode.** Every deployment holds its own keys; there's no "we hold your funds" tier.
- **No fiat off-ramp built in.** Payouts are crypto-only. If you need fiat off-ramping, integrate a Stellar anchor (SEP-24) or off-ramp provider on top — this stays out of core scope so the project doesn't take on a dependency on a paid third party.

Have a use case that needs something here? Say so in an issue — "explicitly not planned" reflects current scope, not a permanent no.
