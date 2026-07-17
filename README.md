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

End-to-end tests run under Playwright. Playwright boots only the SPA preview
(port 4173); the back-end stack — Rails in the `cypress` environment and
anycable-go — is owned by a `Procfile.e2e` in the parent directory, so the
back-end repository must be checked out as a sibling (`../Backend`). Run the
whole suite with `overmind start -f Procfile.e2e`:

```procfile
backend: cd Backend && PORT=5000 ANYCABLE_HTTP_RPC=true rvm 4.0.6@raccoonbets do rails server -e cypress -b 127.0.0.1
ws: cd Backend && rvm 4.0.6@raccoonbets do bin/anycable-go --port=8080 --rpc_host=http://127.0.0.1:5000/_anycable
e2e: cd Frontend && until curl -sfo /dev/null http://127.0.0.1:5000/up; do sleep 1; done && pnpm test:e2e
```

Use `pnpm test:e2e:dev` for the interactive UI runner against a stack started
the same way.

#### Deployment

The app is deployed on Fly.io as `raccoonbets-frontend`, automatically after CI
completes via the `deploy.yml` workflow. In production it sits behind the
`raccoonbets-proxy` nginx app, which fronts the API at `api.raccoonbets.org`.
