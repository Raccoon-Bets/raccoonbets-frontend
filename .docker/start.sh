#!/bin/sh
set -e

# Enforce the Cloudflare-only origin lock when a secret is configured. With
# none set the snippet stays empty and nginx serves normally, so a missing
# secret degrades to today's behavior instead of 403ing every request.
if [ -n "${ORIGIN_SECRET:-}" ]; then
    # envsubst takes the variable list as a literal; expanding it here would
    # substitute the value instead of naming the variable.
    # shellcheck disable=SC2016
    envsubst '${ORIGIN_SECRET}' \
        < /etc/nginx/conf.d/origin-lock.conf.template \
        > /etc/nginx/conf.d/origin-lock.inc
else
    : > /etc/nginx/conf.d/origin-lock.inc
fi

# Start nginx-prometheus-exporter in background
# It connects to stub_status and exposes metrics on :9113/metrics
/usr/local/bin/nginx-prometheus-exporter \
    --nginx.scrape-uri=http://127.0.0.1:8081/stub_status \
    --web.listen-address=:9113 \
    --web.telemetry-path=/metrics &

# Start nginx in foreground
exec /usr/sbin/nginx -g 'daemon off;'
