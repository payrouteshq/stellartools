FROM node:22-alpine AS builder

RUN npm install -g pnpm@latest

WORKDIR /monorepo

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Only the packages the backend needs
COPY packages/stellartools/ ./packages/stellartools/
COPY packages/medusajs-adapter/ ./packages/medusajs-adapter/
COPY examples/medusajs/apps/backend/ ./examples/medusajs/apps/backend/

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @stellartools/core build
RUN pnpm --filter @stellartools/medusajs-adapter build
RUN pnpm --filter @dtc/backend build

# --- runtime image ---
FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /monorepo/examples/medusajs/apps/backend/.medusa/server .

ENV NODE_ENV=production
EXPOSE 9000

CMD ["node", "index.js"]
