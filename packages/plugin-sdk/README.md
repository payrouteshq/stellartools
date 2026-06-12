# @stellartools/plugin-sdk

SDK for building metered integrations (plugins) on top of Stellar Tools. Plugins can report usage, manage entitlements, and expose configuration to the Stellar Tools dashboard.

## Installation

```bash
pnpm add @stellartools/plugin-sdk
```

## Usage

```ts
import { createPlugin } from "@stellartools/plugin-sdk";

export const myPlugin = createPlugin({
  name: "my-integration",
  onUsage: async (event) => {
    /* report metered usage */
  },
});
```

## Development

```bash
pnpm build
```
