# @stellartools/app-embed-bridge

Bidirectional message bridge between Stellar Tools and embedded plugin iframes. Handles secure cross-origin communication, action dispatch, and event forwarding.

## Installation

```bash
pnpm add @stellartools/app-embed-bridge
```

## Usage

```ts
import { createBridge } from "@stellartools/app-embed-bridge";

const bridge = createBridge({ targetOrigin: "https://app.stellartools.dev" });
bridge.on("action", (payload) => {
  /* handle action */
});
```

## Development

```bash
pnpm build      # tsup with DTS
```
