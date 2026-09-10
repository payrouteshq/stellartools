#!/bin/sh
# Multi-purpose entrypoint for the StellarTools Docker services. All three
# service roles share this one script so there's a single place secret
# generation/loading logic lives.
#
# Usage:
#   docker-entrypoint.sh                  -> web server: load shared secrets, then exec "$@"
#   docker-entrypoint.sh generate-secrets -> init service: generate any missing app secrets,
#                                             write them to the shared volume, exit
#   docker-entrypoint.sh cron             -> cron service: load shared secrets, schedule the
#                                             subscription-renewal cron, run crond in the foreground
#
# This never touches Stellar keys (KEEPER_SECRET_*) or the subscription
# contract ID — those involve real on-chain transactions and stay a manual,
# documented step (see DEVELOPMENT.md).
set -e

SHARED_FILE="/shared/generated.env"

gen_secret() {
  node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
}

case "$1" in
generate-secrets)
  mkdir -p /shared
  : >"$SHARED_FILE.new"
  for var in JWT_SECRET MASTER_ENCRYPTION_KEY ENCRYPTION_SALT CRON_SECRET; do
    eval "current=\$$var"
    if [ -z "$current" ]; then
      current=$(gen_secret)
      echo "[stellartools/init] generated $var (not set in apps/web/.env)"
    fi
    echo "export ${var}=${current}" >>"$SHARED_FILE.new"
  done
  mv "$SHARED_FILE.new" "$SHARED_FILE"
  echo "[stellartools/init] secrets ready — set these explicitly in apps/web/.env before production"
  exit 0
  ;;

cron)
  # shellcheck disable=SC1090
  [ -f "$SHARED_FILE" ] && . "$SHARED_FILE"
  : "${CRON_SECRET:?CRON_SECRET missing — did the init service run and complete first?}"
  : "${WEB_INTERNAL_URL:=http://web:3000}"
  # The route only handles GET (matches how Vercel Cron calls it in production).
  echo "0 * * * * wget -q -O- --header=\"Authorization: Bearer ${CRON_SECRET}\" ${WEB_INTERNAL_URL}/dashboard/~api/cron/charge-subscription >>/var/log/stellartools-cron.log 2>&1" >/etc/crontabs/root
  touch /var/log/stellartools-cron.log
  echo "[stellartools/cron] scheduled charge-subscription hourly against ${WEB_INTERNAL_URL}"
  exec crond -f -l 8
  ;;

*)
  # shellcheck disable=SC1090
  [ -f "$SHARED_FILE" ] && . "$SHARED_FILE"
  exec "$@"
  ;;
esac
