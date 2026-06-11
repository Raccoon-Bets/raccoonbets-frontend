import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import OauthButtons from '@/components/oauthButtons.vue'
import config from '@/config'
import i18n from '@/i18n'

describe('oauthButtons.vue', () => {
  it('renders provider forms that POST to the backend with the current origin', () => {
    const wrapper = mount(OauthButtons, {
      global: { plugins: [i18n, PrimeVue] },
    })

    const origin = encodeURIComponent(window.location.origin)
    const googleForm = wrapper.get('[data-testid="oauth-google"]').element.closest('form')
    const appleForm = wrapper.get('[data-testid="oauth-apple"]').element.closest('form')

    expect(googleForm?.getAttribute('method')).toBe('post')
    expect(googleForm?.getAttribute('action')).toBe(`${config.APIURL}/auth/google?origin=${origin}`)
    expect(appleForm?.getAttribute('action')).toBe(`${config.APIURL}/auth/apple?origin=${origin}`)
  })
})
