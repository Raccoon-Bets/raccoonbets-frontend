import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import PrimeVue from 'primevue/config'
import PushPrimingBanner from '@/components/pushPrimingBanner.vue'
import { useAccountStore } from '@/stores/modules/account'
import { useAuthStore } from '@/stores/modules/auth'
import i18n from '@/i18n'
import type { User } from '@/types'

const { ensurePushSubscription } = vi.hoisted(() => ({
  ensurePushSubscription: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/composables/usePushNotifications', async (importOriginal) => ({
  // Keep the real pushSupported() so the banner's support check is exercised by the
  // navigator.serviceWorker/PushManager globals these tests stub (or omit).
  ...(await importOriginal<typeof import('@/composables/usePushNotifications')>()),
  ensurePushSubscription,
  usePushNotifications: vi.fn(),
}))

function buildUser(overrides: Partial<User> = {}): User {
  return {
    email: 'rocky@example.com',
    name: 'Rocky',
    locale: 'en',
    venmoHandle: null,
    paypalHandle: null,
    cashappCashtag: null,
    passkeys: [],
    notificationPreferences: {},
    vapidPublicKey: 'aGVsbG8',
    pushPromptDismissedAt: null,
    ...overrides,
  }
}

function setPermission(permission: NotificationPermission | undefined) {
  if (permission === undefined) {
    vi.stubGlobal('Notification', undefined)
  } else {
    vi.stubGlobal('Notification', { permission })
    vi.stubGlobal('navigator', { serviceWorker: {} })
    vi.stubGlobal('PushManager', {})
  }
}

function mountBanner({
  user,
  loggedIn = true,
}: {
  user: User | null
  loggedIn?: boolean
}) {
  const pinia = createTestingPinia({ createSpy: () => vi.fn(() => Promise.resolve()) })
  const account = useAccountStore(pinia)
  const auth = useAuthStore(pinia)
  account.currentUser = user
  // `loggedIn` is a getter; @pinia/testing lets us override it for the test.
  ;(auth as unknown as { loggedIn: boolean }).loggedIn = loggedIn
  const wrapper = mount(PushPrimingBanner, { global: { plugins: [pinia, i18n, PrimeVue] } })
  return { wrapper, account }
}

describe('pushPrimingBanner.vue', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('shows when logged in, supported, permission default, and not dismissed', () => {
    setPermission('default')
    const { wrapper } = mountBanner({ user: buildUser() })
    expect(wrapper.find('[data-testid="push-priming-banner"]').exists()).toBe(true)
  })

  it('hides when permission is already granted', () => {
    setPermission('granted')
    const { wrapper } = mountBanner({ user: buildUser() })
    expect(wrapper.find('[data-testid="push-priming-banner"]').exists()).toBe(false)
  })

  it('hides when permission is denied', () => {
    setPermission('denied')
    const { wrapper } = mountBanner({ user: buildUser() })
    expect(wrapper.find('[data-testid="push-priming-banner"]').exists()).toBe(false)
  })

  it('hides when already dismissed for the account', () => {
    setPermission('default')
    const { wrapper } = mountBanner({
      user: buildUser({ pushPromptDismissedAt: '2026-01-01T00:00:00.000Z' }),
    })
    expect(wrapper.find('[data-testid="push-priming-banner"]').exists()).toBe(false)
  })

  it('hides when not logged in', () => {
    setPermission('default')
    const { wrapper } = mountBanner({ user: null, loggedIn: false })
    expect(wrapper.find('[data-testid="push-priming-banner"]').exists()).toBe(false)
  })

  it('hides when push is unsupported (no Notification)', () => {
    // setPermission(undefined) leaves navigator.serviceWorker/PushManager unstubbed, so
    // pushSupported() returns false in jsdom — that absence is what hides the banner here.
    setPermission(undefined)
    const { wrapper } = mountBanner({ user: buildUser() })
    expect(wrapper.find('[data-testid="push-priming-banner"]').exists()).toBe(false)
  })

  it('calls ensurePushSubscription with the vapid key on "Yes"', async () => {
    setPermission('default')
    const { wrapper } = mountBanner({ user: buildUser() })
    await wrapper.get('[data-testid="push-priming-enable"]').trigger('click')
    expect(ensurePushSubscription).toHaveBeenCalledWith('aGVsbG8')
    expect(wrapper.find('[data-testid="push-priming-banner"]').exists()).toBe(false)
  })

  it('calls dismissPushPrompt and hides on "Don\'t bother me again"', async () => {
    setPermission('default')
    const { wrapper, account } = mountBanner({ user: buildUser() })
    await wrapper.get('[data-testid="push-priming-dismiss"]').trigger('click')
    expect(account.dismissPushPrompt).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-testid="push-priming-banner"]').exists()).toBe(false)
  })
})
