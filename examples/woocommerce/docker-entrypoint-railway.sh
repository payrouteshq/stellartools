#!/bin/bash
set -euo pipefail

# Railway can enable multiple Apache MPMs at runtime (AH00534). PHP requires prefork.
a2dismod mpm_event 2>/dev/null || true
a2dismod mpm_worker 2>/dev/null || true
rm -f /etc/apache2/mods-enabled/mpm_event.* /etc/apache2/mods-enabled/mpm_worker.* 2>/dev/null || true
a2dismod mpm_prefork 2>/dev/null || true
a2enmod mpm_prefork

# Railway routes traffic to $PORT (default 8080), not 80.
PORT="${PORT:-8080}"
sed -i "s/^Listen .*/Listen ${PORT}/" /etc/apache2/ports.conf
sed -i "s/:80>/:${PORT}>/g" /etc/apache2/sites-available/000-default.conf

if ! grep -q "^ServerName" /etc/apache2/apache2.conf; then
  echo "ServerName localhost" >> /etc/apache2/apache2.conf
fi

# Railway terminates TLS at the edge; WordPress must trust X-Forwarded-Proto or CSS/JS URLs break.
if [ -z "${WORDPRESS_CONFIG_EXTRA:-}" ]; then
  wp_extra='if (isset($_SERVER["HTTP_X_FORWARDED_PROTO"]) && $_SERVER["HTTP_X_FORWARDED_PROTO"] === "https") { $_SERVER["HTTPS"] = "on"; }'
  if [ -n "${RAILWAY_PUBLIC_DOMAIN:-}" ]; then
    wp_extra="${wp_extra} define(\"WP_HOME\", \"https://${RAILWAY_PUBLIC_DOMAIN}\"); define(\"WP_SITEURL\", \"https://${RAILWAY_PUBLIC_DOMAIN}\");"
  fi
  export WORDPRESS_CONFIG_EXTRA="$wp_extra"
fi

apache2ctl configtest

exec docker-entrypoint.sh "$@"
