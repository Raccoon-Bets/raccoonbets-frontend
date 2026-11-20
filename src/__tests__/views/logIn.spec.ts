import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { Err, Ok, type Result } from 'ts-results'
import { createRouter, createMemoryHistory } from 'vue-router'
import PrimeVue from 'primevue/config'
import LogIn from '@/views/auth/logIn.vue'
import { useAuthStore } from '@/stores/modules/auth'
import { usePasskeysStore } from '@/stores/modules/passkeys'
import type { Errors } from '@/stores/types'
import i18n from '@/i18n'
import TurnstileStub from './turnstileStub'

const webAuthn = vi.hoisted(() => ({ autofillSupported: false }))

vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: () => false,
  browserSupportsWebAuthnAutofill: () => Promise.resolve(webAuthn.autofillSupported),
  WebAuthnAbortService: {
    cancelCeremony: () => undefined,
  },
}))

type PasskeyCeremony = () => Promise<Result<void, Errors>>

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: LogIn, name: 'logIn' },
      { path: '/groups', component: { template: '<div />' }, name: 'groups' },
      { path: '/signup', component: { template: '<div />' }, name: 'signUp' },
      { path: '/forgot-password', component: { template: '<div />' }, name: 'forgotPassword' },
    ],
  })
}

function mountLogIn(pinia = createTestingPinia({ createSpy: vi.fn })) {
  const wrapper = mount(LogIn, {
    global: {
      plugins: [pinia, i18n, buildRouter(), PrimeVue],
      stubs: { Turnstile: TurnstileStub },
    },
  })
  return { pinia, wrapper }
}

// Mounts the view with passkey autofill available; the passkeys store answers
// each autofill ceremony in turn, then leaves the next one pending.
async function mountWithAutofill(...ceremonies: PasskeyCeremony[]) {
  webAuthn.autofillSupported = true
  const pinia = createTestingPinia({ createSpy: vi.fn })
  const logIn = vi.mocked(usePasskeysStore(pinia).logIn)
  logIn.mockReturnValue(new Promise(() => undefined))
  for (const ceremony of ceremonies) logIn.mockImplementationOnce(ceremony)
  const { wrapper } = mountLogIn(pinia)
  await flushPromises()
  return { logIn, wrapper }
}

const rejectedByServer: PasskeyCeremony = () =>
  Promise.resolve(new Err({ base: ['webauthn challenge expired'] }))

const canceled: PasskeyCeremony = () =>
  Promise.reject(new DOMException('The operation was aborted.', 'AbortError'))

describe('logIn.vue', () => {
  afterEach(() => {
    webAuthn.autofillSupported = false
  })

  it('disables submit until Turnstile produces a token', () => {
    const { wrapper } = mountLogIn()

    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('passes turnstile_token in the logIn payload', async () => {
    const { pinia, wrapper } = mountLogIn()

    const authStore = useAuthStore(pinia)
    vi.mocked(authStore.logIn).mockResolvedValue(new Ok(undefined))

    await wrapper.get('input[name="session[login]"]').setValue('sancho@example.com')
    await wrapper.get('input[name="session[password]"]').setValue('supersecret')
    await wrapper.get('[data-testid="turnstile-stub"]').trigger('click')
    await wrapper.get('form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(authStore.logIn).toHaveBeenCalledWith({
      login: 'sancho@example.com',
      password: 'supersecret',
      turnstile_token: 'fake-turnstile-token',
    })
  })

  describe('passkey autofill', () => {
    it('restarts with fresh options and shows the error when the server rejects a passkey', async () => {
      const { logIn, wrapper } = await mountWithAutofill(rejectedByServer)

      expect(logIn).toHaveBeenCalledTimes(2)
      expect(logIn).toHaveBeenLastCalledWith({ useBrowserAutofill: true })
      expect(wrapper.get('[data-testid="login-passkey-error"]').text()).toBe(
        'webauthn challenge expired',
      )
    })

    it('stops once the ceremony is canceled', async () => {
      const { logIn, wrapper } = await mountWithAutofill(canceled)

      expect(logIn).toHaveBeenCalledTimes(1)
      expect(wrapper.find('[data-testid="login-passkey-error"]').exists()).toBe(false)
    })

    it('does not restart after the view unmounts', async () => {
      let settleCeremony: (result: Result<void, Errors>) => void = () => undefined
      const { logIn, wrapper } = await mountWithAutofill(
        () =>
          new Promise((resolve) => {
            settleCeremony = resolve
          }),
      )

      wrapper.unmount()
      settleCeremony(new Err({ base: ['webauthn challenge expired'] }))
      await flushPromises()

      expect(logIn).toHaveBeenCalledTimes(1)
    })
  })
})
