import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Turnstile from '@/components/turnstile.vue'
import i18n from '@/i18n'

// Reproduce vue-turnstile's behaviour when Cloudflare's script can't load: its
// mounted() hook rejects with the bare string 'Failed to load Turnstile.'.
vi.mock('vue-turnstile', () => ({
  default: defineComponent({
    name: 'VueTurnstile',
    inheritAttrs: false,
    mounted() {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      return Promise.reject('Failed to load Turnstile.')
    },
    render: () => h('div'),
  }),
}))

describe('turnstile.vue', () => {
  it('shows a recoverable notice when the Turnstile script fails to load', async () => {
    const wrapper = mount(Turnstile, {
      props: { siteKey: 'site-key' },
      global: { plugins: [i18n, PrimeVue] },
    })

    await flushPromises()

    const notice = wrapper.get('[data-testid="turnstile-error"]')
    expect(notice.text()).toContain('Couldn’t load verification')
  })
})
