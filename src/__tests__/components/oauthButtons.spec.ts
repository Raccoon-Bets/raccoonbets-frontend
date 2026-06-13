import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import OauthButtons from '@/components/oauthButtons.vue'
import config from '@/config'
import i18n from '@/i18n'

describe('oauthButtons.vue', () => {
  it('renders provider forms that POST to the apex OAuth broker with the current origin', () => {
    const wrapper = mount(OauthButtons, {
      global: { plugins: [i18n, PrimeVue] },
    })

    const origin = encodeURIComponent(window.location.origin)
    const { protocol, port } = window.location
    const apexOrigin = `${protocol}//${config.apexDomain}${port ? `:${port}` : ''}`
    const googleForm = wrapper.get('[data-testid="oauth-google"]').element.closest('form')
    const appleForm = wrapper.get('[data-testid="oauth-apple"]').element.closest('form')

    expect(googleForm?.getAttribute('method')).toBe('post')
    expect(googleForm?.getAttribute('action')).toBe(`${apexOrigin}/auth/google?origin=${origin}`)
    expect(appleForm?.getAttribute('action')).toBe(`${apexOrigin}/auth/apple?origin=${origin}`)
  })
})
