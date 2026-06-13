import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { requestJSON } from '@/stores/modules/root'
import { useAuthStore } from '@/stores/modules/auth'
import { useAccountStore } from '@/stores/modules/account'
import { urlBase64ToUint8Array } from '@/utils/webPush'
import { notifySentry } from '@/utils/errors'

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/**
 * Registers this browser for Web Push. Prompts for permission when it is still
 * `default` — call this only in response to a user gesture (the priming banner
 * or the settings button), then subscribes and persists the subscription. Safe
 * to call when unsupported.
 *
 * @param vapidPublicKey The server's VAPID public key, used as the application server key.
 */
export async function ensurePushSubscription(vapidPublicKey: string): Promise<void> {
  if (!pushSupported()) return
  if (Notification.permission === 'denied') return
  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission()
    if (result !== 'granted') return
  }

  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }))

  const json = subscription.toJSON()
  await requestJSON({
    method: 'POST',
    path: '/account/push_subscriptions',
    body: { endpoint: json.endpoint, keys: json.keys, user_agent: navigator.userAgent },
  })
}

/** Silently re-subscribes already-granted devices after login. Call once from App.vue setup. */
export function usePushNotifications(): void {
  const auth = useAuthStore()
  const account = useAccountStore()
  const { loggedIn } = storeToRefs(auth)
  const { currentUser } = storeToRefs(account)

  // Re-subscribe silently on load only when the user has ALREADY granted
  // permission on this device. We never call requestPermission() here — the
  // priming banner / settings button is the only place the native prompt fires.
  watch(
    [loggedIn, currentUser],
    ([isLoggedIn, user]) => {
      const vapidPublicKey = user?.vapidPublicKey
      if (!isLoggedIn || vapidPublicKey === null || vapidPublicKey === undefined) return
      if (!('Notification' in window) || Notification.permission !== 'granted') return
      void ensurePushSubscription(vapidPublicKey).catch(notifySentry)
    },
    { immediate: true },
  )
}
