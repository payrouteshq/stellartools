# StellarTools — Next.js Adapter Demos

Interactive demos for every StellarTools adapter, running inside a single Next.js 15 App Router project.

| Adapter     | Package                             | Route          |
| ----------- | ----------------------------------- | -------------- |
| BetterAuth  | `@stellartools/betterauth-adapter`  | `/betterauth`  |
| AI SDK      | `@stellartools/aisdk-adapter`       | `/aisdk`       |
| LangChain   | `@stellartools/langchain-adapter`   | `/langchain`   |
| UploadThing | `@stellartools/uploadthing-adapter` | `/uploadthing` |

## Setup

```bash
cp .env.example .env.local
# fill in your values

pnpm install          # from monorepo root
pnpm --filter @stellartools/example-nextjs dev
# → http://localhost:3001
```

## Environment variables

| Variable              | Required by                   |
| --------------------- | ----------------------------- |
| `STELLAR_API_KEY`     | all adapters                  |
| `STELLARTOOLS_PRODUCT_ID`  | aisdk, langchain, uploadthing |
| `OPENAI_API_KEY`      | aisdk, langchain              |
| `UPLOADTHING_TOKEN`   | uploadthing                   |
| `NEXT_PUBLIC_APP_URL` | betterauth                    |
