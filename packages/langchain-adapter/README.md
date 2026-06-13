# @stellartools/langchain-adapter

LangChain adapter for Stellar Tools. Expose Stellar Tools as LangChain tools in your AI agents.

## Installation

```bash
pnpm add @stellartools/langchain-adapter
```

## Usage

```ts
import { StellarToolsToolkit } from "@stellartools/langchain-adapter";

const toolkit = new StellarToolsToolkit({ apiKey: process.env.STELLAR_API_KEY });
const tools = toolkit.getTools();
```

## Development

```bash
pnpm build
```
