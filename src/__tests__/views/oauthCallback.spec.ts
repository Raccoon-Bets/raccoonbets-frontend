import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createRouter, createMemoryHistory } from 'vue-router'
import PrimeVue from 'primevue/config'
import OauthCallback from '@/views/auth/oauthCallback.vue'
import { useAuthStore } from '@/stores/modules/auth'
import { useAccountStore } from '@/stores/modules/account'
import { notifySentry } from '@/utils/errors'
import i18n from '@/i18n'

vi.mock('@/utils/errors', () => ({ notifySentry: vi.fn() }))

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/oauth/callback', component: OauthCallback, name: 'oauthCallback' },
      { path: '/groups', component: { template: '<div />' }, name: 'groups' },
      { path: '/', component: { template: '<div />' }, name: 'feed' },
      { path: '/login', component: { template: '<div />' }, name: 'logIn' },
    ],
  })
}

function mountCallback() {
  const pinia = createTestingPinia({ createSpy: vi.fn })
  const router = buildRouter()
  const wrapper = mount(OauthCallback, {
    global: { plugins: [pinia, i18n, router, PrimeVue] },
  })
  return { wrapper, pinia, router }
}

afterEach(() => {
  window.location.hash = ''
})

describe('oauthCallback.vue', () => {
  it('stores the tokens, loads the profile, and routes into the app', async () => {
    window.location.hash = '#access_token=access-123&refresh_token=refresh-456'

    const { pinia, router } = mountCallback()
    const auth = useAuthStore(pinia)
    const account = useAccountStore(pinia)
    const push = vi.spyOn(router, 'push')

    await flushPromises()

    expect(auth.setOAuthTokens).toHaveBeenCalledWith('access-123', 'refresh-456')
    expect(account.loadAccount).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith({ name: 'groups' })
  })

  it('shows an error and writes no tokens when the fragment carries an error', async () => {
    window.location.hash = '#error=failed'

    const { wrapper, pinia } = mountCallback()
    const auth = useAuthStore(pinia)

    await flushPromises()

    expect(auth.setOAuthTokens).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="oauth-error"]').exists()).toBe(true)
    expect(notifySentry).toHaveBeenCalled()
  })
})
