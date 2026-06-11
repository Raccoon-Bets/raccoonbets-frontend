#!/bin/sh
set -e

# Start nginx-prometheus-exporter in background
# It connects to stub_status and exposes metrics on :9113/metrics
/usr/local/bin/nginx-prometheus-exporter \
    --nginx.scrape-uri=http://127.0.0.1:8081/stub_status \
    --web.listen-address=:9113 \
    --web.telemetry-path=/metrics &

# Start nginx in foreground
exec /usr/sbin/nginx -g 'daemon off;'
