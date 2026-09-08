# syntax=docker/dockerfile:1
#
# Builds and runs @stellartools/web for self-hosting.
# Build from the REPO ROOT (docker-compose.yml does this for you):
#   docker build -f apps/web/Dockerfile -t stellartools-web .

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ---- install workspace dependencies ----
FROM base AS deps
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile

# ---- build the reusable packages, then the app ----
FROM base AS builder
WORKDIR /repo
COPY --from=deps /repo .
RUN pnpm -w --filter @stellartools/core run build:prod \
  && pnpm -w --filter @stellartools/app-sdk run build \
  && pnpm -w --filter @stellartools/shared-ui run build \
  && pnpm --filter @stellartools/web run web:build

# ---- slim runtime image ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
