# @stellartools/betterauth-adapter

BetterAuth adapter for Stellar Tools. Integrates Stellar Tools billing into your BetterAuth authentication setup.

## Installation

```bash
pnpm add @stellartools/betterauth-adapter
```

## Usage

```ts
import { stellartools } from "@stellartools/betterauth-adapter";

export const auth = betterAuth({
  plugins: [stellartools({ apiKey: process.env.STELLAR_API_KEY })],
});
```

## Development

```bash
pnpm build
```
