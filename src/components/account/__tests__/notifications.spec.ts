import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import PrimeVue from 'primevue/config'
import AccountNotifications from '@/components/account/notifications.vue'
import { useAccountStore } from '@/stores/modules/account'
import i18n from '@/i18n'
import type { User } from '@/types'

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
    vapidPublicKey: null,
    ...overrides,
  }
}

function mountPanel(user: User) {
  const pinia = createTestingPinia({ createSpy: vi.fn })
  const account = useAccountStore(pinia)
  account.currentUser = user
  const wrapper = mount(AccountNotifications, {
    global: { plugins: [pinia, i18n, PrimeVue] },
  })
  return { wrapper, account }
}

describe('notifications.vue', () => {
  it('renders every event x channel as ON when a pref key is absent', () => {
    // market_created.email is the only override; everything else defaults to ON.
    const user = buildUser({
      notificationPreferences: { market_created: { email: false } },
    })
    const { wrapper } = mountPanel(user)

    const marketResolvedEmail = wrapper
      .get('[data-testid="pref-market_resolved-email"]')
      .get('input')
    const marketCreatedEmail = wrapper.get('[data-testid="pref-market_created-email"]').get('input')

    // Absent key (market_resolved) defaults ON; explicit false (market_created.email) is OFF.
    expect((marketResolvedEmail.element as HTMLInputElement).checked).toBe(true)
    expect((marketCreatedEmail.element as HTMLInputElement).checked).toBe(false)
  })

  it('saves with the toggled channel set to false', async () => {
    const { wrapper, account } = mountPanel(buildUser())

    const input = wrapper.get('[data-testid="pref-market_created-email"]').get('input')
    await input.setValue(false)

    expect(account.updateNotificationPreferences).toHaveBeenCalledTimes(1)
    const preferences = vi.mocked(account.updateNotificationPreferences).mock.calls[0][0]
    expect(preferences.market_created?.email).toBe(false)
    // Untouched channels stay ON.
    expect(preferences.market_created?.push).toBe(true)
    expect(preferences.market_resolved?.email).toBe(true)
  })
})
