import type { Config } from '@/config/type'

const config: Config = {
  sentryDSN: String(import.meta.env.VITE_SENTRY_DSN ?? ''),
  APIURL: String(import.meta.env.VITE_API_URL ?? ''),
  actionCableURL: String(import.meta.env.VITE_ACTION_CABLE_URL ?? ''),
  apexDomain: String(import.meta.env.VITE_APEX_DOMAIN ?? 'lvh.me'),
  TURNSTILE_SITE_KEY: String(import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA'),
}

export default config
