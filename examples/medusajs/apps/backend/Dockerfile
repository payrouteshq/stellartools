FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /monorepo

# Copy the full monorepo (see .dockerignore for exclusions)
COPY . .

# Install all workspace deps
RUN pnpm install --frozen-lockfile

# Build workspace deps in dependency order
RUN pnpm --filter @stellartools/core build
RUN pnpm --filter @stellartools/medusajs-adapter build

# Build Medusa backend (outputs to .medusa/server with bundled node_modules)
WORKDIR /monorepo/examples/medusajs/apps/backend
RUN pnpm run build

# --- runtime image ---
FROM node:22-alpine AS runner

WORKDIR /app

# .medusa/server is a self-contained bundle — no extra node_modules needed
COPY --from=builder /monorepo/examples/medusajs/apps/backend/.medusa/server .

ENV NODE_ENV=production
EXPOSE 9000

CMD ["node", "index.js"]
