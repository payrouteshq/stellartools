FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /monorepo

# Copy the full monorepo (see .dockerignore for exclusions)
COPY . .

# Install all workspace deps
# usb is in neverBuiltDependencies (no USB hardware in a web server)
# tiny-secp256k1 falls back to pure JS if native build fails
# better-sqlite3/@swc/core download prebuilt binaries — no gcc needed
RUN pnpm install --frozen-lockfile

# Build workspace deps in dependency order
RUN pnpm --filter @stellartools/core build
RUN pnpm --filter @stellartools/medusajs-adapter build

# Build Medusa backend (outputs compiled source to .medusa/server)
WORKDIR /monorepo/examples/medusajs/apps/backend
RUN pnpm run build

ENV NODE_ENV=production
EXPOSE 9000

# Run from .medusa/server so rootDirectory resolves admin at ./public/admin/
# Node.js module resolution traverses up and finds node_modules at /monorepo/node_modules/
WORKDIR /monorepo/examples/medusajs/apps/backend/.medusa/server
CMD ["sh", "-c", "/monorepo/examples/medusajs/apps/backend/node_modules/.bin/medusa start"]
