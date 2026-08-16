/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ACTION_CABLE_URL: string
  readonly VITE_APEX_DOMAIN: string
  readonly VITE_API_URL: string
  readonly VITE_SENTRY_DSN: string
  readonly VITE_SENTRY_RELEASE: string
  readonly VITE_TURNSTILE_SITE_KEY: string
}

declare module '@fontsource-variable/*'
