import '@/zodConfig'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import * as Sentry from '@sentry/vue'
import { createSentryPiniaPlugin } from '@sentry/vue'
import PrimeVue from 'primevue/config'

import App from './App.vue'
import router from './router'
import i18n, { initLocale } from '@/i18n'
import config from '@/config'
import stickerClubPreset from '@/config/theme'

import '@fontsource-variable/baloo-2'
import '@fontsource-variable/nunito'
import 'primeicons/primeicons.css'
import './styles/_tokens.scss'
import './styles/base.scss'

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const app = createApp(App)

if (config.sentryDSN) {
  Sentry.init({
    app,
    dsn: config.sentryDSN,
    sendDefaultPii: true,
    integrations: [
      Sentry.vueIntegration({
        tracingOptions: {
          trackComponents: true,
        },
      }),
      Sentry.browserTracingIntegration({ router }),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    enableLogs: true,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
}

const pinia = createPinia()
if (config.sentryDSN) {
  pinia.use(createSentryPiniaPlugin())
}
app.use(pinia)
app.use(router)
app.use(i18n)
app.use(PrimeVue, {
  theme: { preset: stickerClubPreset, options: { darkModeSelector: 'system' } },
})

// Global Vue error handler — forwards uncaught component errors to Sentry
// when configured. In dev, Vue's own warnings will surface in the console.
app.config.errorHandler = (err, _instance, info) => {
  if (config.sentryDSN) {
    Sentry.captureException(err, {
      extra: { componentInfo: info },
    })
  }
}

// A deploy replaces the content-hashed route chunks, so a client still running
// an older page fails to lazy-load a route with "Failed to fetch dynamically
// imported module". Vite fires `vite:preloadError` for exactly this; reloading
// pulls the fresh chunks (and the auto-updating service worker's new precache).
// The sessionStorage guard stops a genuinely missing chunk from reloading
// forever — a second failure is reported to Sentry instead.
const PRELOAD_RELOADED_KEY = 'rb-preload-reloaded'
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  if (sessionStorage.getItem(PRELOAD_RELOADED_KEY)) {
    if (config.sentryDSN) Sentry.captureException(event.payload)
    return
  }
  sessionStorage.setItem(PRELOAD_RELOADED_KEY, '1')
  window.location.reload()
})

initLocale()
app.mount('#app')
// A clean boot means the chunks loaded, so re-arm the one-shot reload guard for
// the next deploy.
sessionStorage.removeItem(PRELOAD_RELOADED_KEY)
