import type { Config } from '@/config/type'

const config: Config = {
  sentryDSN: import.meta.env.VITE_SENTRY_DSN || '',
  APIURL: import.meta.env.VITE_API_URL || '',
  actionCableURL: import.meta.env.VITE_ACTION_CABLE_URL || '',
  apexDomain: import.meta.env.VITE_APEX_DOMAIN || 'lvh.me',
  TURNSTILE_SITE_KEY: import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA',
}

export default config
