/** Runtime configuration resolved from `import.meta.env` at build time. */
export interface Config {
  /** Sentry DSN; error reporting is disabled when empty. */
  sentryDSN: string

  /** Base URL of the Rails API (e.g. `http://api.lvh.me:5000`). */
  APIURL: string

  /** WebSocket URL of the AnyCable server (e.g. `ws://ws.lvh.me:8080/cable`). */
  actionCableURL: string

  /**
   * The apex domain the SPA is served from (e.g. `raccoonbets.org`, `lvh.me` in dev). Hostnames
   * below this domain are group subdomains; the apex itself hosts the marketing/account app.
   */
  apexDomain: string

  /** Cloudflare Turnstile site key used on auth forms. */
  TURNSTILE_SITE_KEY: string
}
