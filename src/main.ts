import '@/zodConfig'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import * as Sentry from '@sentry/vue'
import PrimeVue from 'primevue/config'

import App from './App.vue'
import router from './router'
import i18n, { initLocale } from '@/i18n'
import config from '@/config'
import stickerClubPreset from '@/config/theme'
import { recoverFromPreloadErrors } from '@/utils/preloadRecovery'

import '@fontsource-variable/baloo-2'
import '@fontsource-variable/nunito'
import 'primeicons/primeicons.css'
import './styles/_tokens.scss'
import './styles/base.scss'

recoverFromPreloadErrors()

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const app = createApp(App)

if (config.sentryDSN) {
  Sentry.init({
    app,
    dsn: config.sentryDSN,
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    environment: import.meta.env.PROD ? 'production' : 'development',
    sendDefaultPii: false,
    integrations: [
      Sentry.vueIntegration({ tracingOptions: { trackComponents: true } }),
      Sentry.browserTracingIntegration({ router }),
    ],
    // no replayIntegration, no createSentryPiniaPlugin
    tracesSampleRate: 1.0,
    enableLogs: true,
    ignoreErrors: [
      // Browser-extension content scripts inject WebExtension messaging into
      // the page; their failures are not our code and are unfixable here.
      // Sentry TIM-DOT-CODES-6.
      /runtime\.sendMessage/u,
      // vite-plugin-pwa's injected SW registration throws InvalidStateError
      // when Chrome registers during prerender. No elegant in-plugin or
      // newer-version fix exists, so we filter the noise. Sentry
      // TIM-DOT-CODES-5.
      /Failed to register a ServiceWorker/u,
      // Native in-app browsers (WKWebView wrappers) inject a bridge script that
      // calls `window.webkit.messageHandlers`; it throws when that handler is
      // absent. Not our code and unfixable here. Sentry TIM-DOT-CODES-8.
      /messageHandlers/u,
      // Android WebView tears down its JS bridge mid-post, so a `postMessage`
      // from the injected bridge rejects with "Java object is gone". Not our
      // code and unfixable here. Sentry RACCOONBETS-FRONTEND-D.
      /Java object is gone/u,
      // Microsoft's Outlook SafeLinks crawler rejects a promise from its own
      // injected instrumentation while previewing a link. It arrives without a
      // stacktrace from an Azure address, never from a visitor. Sentry
      // TIM-DOT-CODES-C.
      /Object Not Found Matching Id/u,
    ],
  })
}

const pinia = createPinia()
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

/**
 * Installs the Workbox service worker that backs offline use.
 *
 * A failed registration costs offline caching and nothing else, so the
 * rejection is logged rather than left to surface as an unhandled error.
 */
function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    const swURL = `${import.meta.env.BASE_URL}sw.js`
    navigator.serviceWorker
      .register(swURL, { scope: import.meta.env.BASE_URL })
      .catch((error: unknown) => {
        Sentry.logger.warn('Service worker registration failed', {
          reason: error instanceof Error ? error.message : String(error),
        })
      })
  })
}

initLocale()
app.mount('#app')

// Only a production build emits `sw.js`.
if (import.meta.env.PROD) registerServiceWorker()
