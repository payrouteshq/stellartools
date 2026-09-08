#!/bin/sh
# Runs as the container's ENTRYPOINT before the Next.js server starts.
#
# If JWT_SECRET / MASTER_ENCRYPTION_KEY / ENCRYPTION_SALT / CRON_SECRET
# weren't provided via apps/web/.env, generate them once and persist them
# to the mounted data volume so `docker compose up` works immediately on
# a fresh clone, and the generated values survive container restarts.
#
# This does NOT generate Stellar keys (KEEPER_SECRET_*) or deploy the
# subscription contract (SUBSCRIPTION_CONTRACT_*_ID) — those involve real
# on-chain transactions and are documented as a manual one-time step.
set -e

DATA_DIR="/app/data"
GEN_FILE="$DATA_DIR/generated.env"
mkdir -p "$DATA_DIR"

# shellcheck disable=SC1090
[ -f "$GEN_FILE" ] && . "$GEN_FILE"

gen_secret() {
  node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
}

new_vars=""
for var in JWT_SECRET MASTER_ENCRYPTION_KEY ENCRYPTION_SALT CRON_SECRET; do
  eval "current=\$$var"
  if [ -z "$current" ]; then
    current=$(gen_secret)
    export "$var=$current"
    new_vars="${new_vars}export ${var}=${current}
"
  fi
done

if [ -n "$new_vars" ]; then
  printf '%s' "$new_vars" >>"$GEN_FILE"
  echo "[stellartools] generated missing local secrets on first boot -> $GEN_FILE (persisted via the data volume)"
  echo "[stellartools] set these explicitly in apps/web/.env before anything beyond a local/testnet trial"
fi

exec "$@"
