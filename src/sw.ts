/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { clientsClaim } from 'workbox-core'
import { NetworkFirst } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: { url: string; revision: string | null }[]
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Navigations go to the network first so the document always arrives with the
// server's current response headers (CSP in particular — a precached shell
// would pin the headers it was cached with, and header-only deploys never
// change the shell's content hash, so the worker would never update). The
// precached shell is only an offline/timeout fallback.
const navigationStrategy = new NetworkFirst({
  cacheName: 'navigations',
  networkTimeoutSeconds: 3,
})
const precachedShell = createHandlerBoundToURL('index.html')

registerRoute(
  new NavigationRoute(
    async (params) => {
      try {
        return await navigationStrategy.handle(params)
      } catch {
        return precachedShell(params)
      }
    },
    { denylist: [/^\/api/, /\.map$/] },
  ),
)

void self.skipWaiting()
clientsClaim()

self.addEventListener('push', (event: PushEvent) => {
  const data = (event.data?.json() ?? {}) as {
    title?: string
    body?: string
    url?: string
    tag?: string
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Raccoon Bets', {
      body: data.body,
      data: { url: data.url ?? '/' },
      tag: data.tag,
    }),
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string }).url ?? '/'
  event.waitUntil(self.clients.openWindow(url))
})
