# Raccoon Bets

[![CI](https://github.com/RISCfuture/raccoonbets-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/RISCfuture/raccoonbets-frontend/actions/workflows/ci.yml)
[![Deploy](https://github.com/RISCfuture/raccoonbets-frontend/actions/workflows/deploy.yml/badge.svg)](https://github.com/RISCfuture/raccoonbets-frontend/actions/workflows/deploy.yml)

Raccoon Bets is a private prediction market for friend groups. Members create
markets like "Will Wenting finish her marathon in under 4:30?", put a dollar or
two into a parimutuel pool, and settle up over Venmo when the dust settles. Each
friend group lives on its own subdomain of
[raccoonbets.org](https://raccoonbets.org).

This repository contains the Vue 3 single-page app, served on the apex and on
every group subdomain. The Rails API lives in a separate repository at
<https://github.com/RISCfuture/raccoonbets-backend>.

## Development

### Installation and Running

The front-end requires Node 26 and pnpm. Run `pnpm install` to install
dependencies, then `pnpm dev` to start a Vite development server.

The app requires the back-end to be running as well. Clone the
[back-end repository](https://github.com/RISCfuture/raccoonbets-backend) as a
sibling directory; its readme has an example `Procfile` that runs the whole
stack with `overmind`.

Local hosts use `lvh.me`, which resolves any subdomain to 127.0.0.1:

- Apex: <http://lvh.me:5173>
- A group: <http://your-group.lvh.me:5173>

#### Testing

Run unit tests with `pnpm test:unit` and the linters with `pnpm lint`.

End-to-end tests run under Playwright with `pnpm test:e2e`. Playwright boots the
whole stack itself — the SPA preview, Rails in the cypress environment, and
AnyCable — so the back-end repository must be checked out as a sibling directory
(`../Backend`). Use `overmind start -f Procfile.e2e` instead when you want the
same stack running interactively (`pnpm test:e2e:dev`).

#### Deployment

The app is deployed on Fly.io as `raccoonbets-frontend`, automatically after CI
completes via the `deploy.yml` workflow. In production it sits behind the
`raccoonbets-proxy` nginx app, which fronts the API at `api.raccoonbets.org`.
