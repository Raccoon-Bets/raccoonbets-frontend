# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=26.4
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Vite"

# Vite app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
# Node 26 images no longer bundle corepack, so install it before enabling.
RUN npm install -g corepack@latest && corepack enable


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
# hadolint ignore=DL3008
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends python-is-python3 pkg-config build-essential && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/archives

# Copy application code and install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Copy remaining application code
COPY . .

# Build-time configuration baked into the Vite bundle. Passed by the deploy
# workflow via `flyctl deploy --build-arg ...`; everything else comes from
# .env.production.
ARG VITE_SENTRY_DSN
ARG VITE_TURNSTILE_SITE_KEY
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY

# Build the application, generate the nginx config with CSP script hashes
# from the built HTML, and remove development dependencies
RUN pnpm run build && \
    node scripts/generate-nginx-conf.mjs && \
    pnpm prune --prod


# Download nginx-prometheus-exporter
FROM alpine:3.23 AS exporter-download
SHELL ["/bin/ash", "-o", "pipefail", "-c"]

ARG EXPORTER_VERSION=1.5.1
RUN wget -qO- https://github.com/nginxinc/nginx-prometheus-exporter/releases/download/v${EXPORTER_VERSION}/nginx-prometheus-exporter_${EXPORTER_VERSION}_linux_amd64.tar.gz \
    | tar xzf - -C /tmp \
    && chmod +x /tmp/nginx-prometheus-exporter


# Final stage for app image
FROM nginx:1.30-alpine

# Copy exporter binary
COPY --from=exporter-download /tmp/nginx-prometheus-exporter /usr/local/bin/

# Copy nginx configuration
COPY .docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/.docker/default.conf.generated /etc/nginx/conf.d/default.conf

# Copy startup script
COPY .docker/start.sh /start.sh
RUN chmod +x /start.sh

# Copy built application
COPY --from=build /app/dist /usr/share/nginx/html

# Start the server by default, this can be overwritten at runtime
EXPOSE 8080 9113
CMD [ "/start.sh" ]
