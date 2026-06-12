# @stellartools/core

Core TypeScript SDK for the Stellar Tools API. Provides typed client methods, resource helpers, and shared types used across all Stellar Tools packages and apps.

## Installation

```bash
pnpm add @stellartools/core
```

## Usage

```ts
import { StellarTools } from "@stellartools/core";

const client = new StellarTools({ apiKey: process.env.STELLAR_API_KEY });

const products = await client.products.list();
const checkout = await client.checkouts.create({ productId: "prod_..." });
```

## Development

```bash
pnpm build        # tsup — outputs CJS + ESM + DTS
pnpm build:dev    # tsup without minification (used by apps/web during local dev)
```
