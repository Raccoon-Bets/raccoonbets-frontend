import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { Ok } from 'ts-results'
import { createRouter, createMemoryHistory } from 'vue-router'
import PrimeVue from 'primevue/config'
import LogIn from '@/views/auth/logIn.vue'
import { useAuthStore } from '@/stores/modules/auth'
import i18n from '@/i18n'
import TurnstileStub from './turnstileStub'

vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: () => false,
  browserSupportsWebAuthnAutofill: () => Promise.resolve(false),
  WebAuthnAbortService: {
    cancelCeremony: () => undefined,
  },
}))

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

describe('logIn.vue', () => {
  it('disables submit until Turnstile produces a token', () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(LogIn, {
      global: {
        plugins: [pinia, i18n, buildRouter(), PrimeVue],
        stubs: { Turnstile: TurnstileStub },
      },
    })

    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('passes turnstile_token in the logIn payload', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(LogIn, {
      global: {
        plugins: [pinia, i18n, buildRouter(), PrimeVue],
        stubs: { Turnstile: TurnstileStub },
      },
    })

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
})
