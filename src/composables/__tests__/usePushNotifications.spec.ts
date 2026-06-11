import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Ok } from 'ts-results'

// The composable calls requestJSON from the root store module; mock it so no
// real network happens and we can assert the POST it makes. Hoisted so the mock
// factory (which vitest lifts to the top of the file) can reference it.
const { requestJSON } = vi.hoisted(() => ({ requestJSON: vi.fn() }))
vi.mock('@/stores/modules/root', () => ({ requestJSON }))

import { ensurePushSubscription } from '@/composables/usePushNotifications'

const VAPID_KEY = 'aGVsbG8' // "hello"

const subscriptionJSON = {
  endpoint: 'https://push.example.com/abc',
  keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
}

/** Installs a controllable serviceWorker/PushManager/Notification environment. */
function installPushEnvironment({
  permission,
  existingSubscription = null,
}: {
  permission: NotificationPermission
  existingSubscription?: { toJSON: () => unknown } | null
}): {
  requestPermission: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
  getSubscription: ReturnType<typeof vi.fn>
} {
  const subscribe = vi.fn().mockResolvedValue({ toJSON: () => subscriptionJSON })
  const getSubscription = vi.fn().mockResolvedValue(existingSubscription)
  const requestPermission = vi.fn().mockResolvedValue('granted')

  vi.stubGlobal('Notification', { permission, requestPermission })

  // `pushSupported()` only checks `'PushManager' in window`; any value satisfies it.
  vi.stubGlobal('PushManager', {})

  vi.stubGlobal('navigator', {
    userAgent: 'Test/UA',
    serviceWorker: {
      ready: Promise.resolve({ pushManager: { getSubscription, subscribe } }),
    },
  })

  return { requestPermission, subscribe, getSubscription }
}

describe('ensurePushSubscription', () => {
  beforeEach(() => {
    requestJSON.mockResolvedValue(new Ok({ response: new Response(), body: undefined }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('subscribes and POSTs the subscription when permission is already granted', async () => {
    const { subscribe } = installPushEnvironment({ permission: 'granted' })

    await ensurePushSubscription(VAPID_KEY)

    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }))
    expect(requestJSON).toHaveBeenCalledWith({
      method: 'POST',
      path: '/account/push_subscriptions',
      body: {
        endpoint: subscriptionJSON.endpoint,
        keys: subscriptionJSON.keys,
        user_agent: 'Test/UA',
      },
    })
  })

  it('prompts when permission is default and proceeds once granted', async () => {
    const { requestPermission, subscribe } = installPushEnvironment({ permission: 'default' })

    await ensurePushSubscription(VAPID_KEY)

    expect(requestPermission).toHaveBeenCalledOnce()
    expect(subscribe).toHaveBeenCalledOnce()
    expect(requestJSON).toHaveBeenCalledOnce()
  })

  it('does nothing when permission is denied', async () => {
    const { requestPermission, subscribe } = installPushEnvironment({ permission: 'denied' })

    await ensurePushSubscription(VAPID_KEY)

    expect(requestPermission).not.toHaveBeenCalled()
    expect(subscribe).not.toHaveBeenCalled()
    expect(requestJSON).not.toHaveBeenCalled()
  })

  it('reuses an existing subscription instead of subscribing again', async () => {
    const existingSubscription = { toJSON: () => subscriptionJSON }
    const { subscribe } = installPushEnvironment({
      permission: 'granted',
      existingSubscription,
    })

    await ensurePushSubscription(VAPID_KEY)

    expect(subscribe).not.toHaveBeenCalled()
    expect(requestJSON).toHaveBeenCalledOnce()
  })

  it('no-ops in an unsupported environment', async () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('Notification', undefined)

    await ensurePushSubscription(VAPID_KEY)

    expect(requestJSON).not.toHaveBeenCalled()
  })
})
