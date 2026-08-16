# syntax = docker/dockerfile:1

# Download nginx-prometheus-exporter
FROM alpine:3.23 AS exporter-download
SHELL ["/bin/ash", "-o", "pipefail", "-c"]

ARG EXPORTER_VERSION=1.5.1
RUN wget -qO- https://github.com/nginxinc/nginx-prometheus-exporter/releases/download/v${EXPORTER_VERSION}/nginx-prometheus-exporter_${EXPORTER_VERSION}_linux_amd64.tar.gz \
    | tar xzf - -C /tmp \
    && chmod +x /tmp/nginx-prometheus-exporter


# Final stage for app image
FROM nginx:1.30-alpine

LABEL fly_launch_runtime="Vite"

# Copy exporter binary
COPY --from=exporter-download /tmp/nginx-prometheus-exporter /usr/local/bin/

# Copy nginx configuration
COPY .docker/nginx.conf /etc/nginx/nginx.conf
COPY .docker/default.conf /etc/nginx/conf.d/default.conf
COPY .docker/origin-lock.conf.template /etc/nginx/conf.d/origin-lock.conf.template

# Copy startup script
COPY .docker/start.sh /start.sh
RUN chmod +x /start.sh

# Copy built application
COPY dist /usr/share/nginx/html

# Start the server by default, this can be overwritten at runtime
EXPOSE 8080 9113
CMD [ "/start.sh" ]
