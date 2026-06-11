import { defineComponent, h } from 'vue'

/**
 * Stub of `@/components/turnstile.vue` for unit tests. Avoids loading
 * Cloudflare's script in jsdom and immediately emits a fake token so
 * forms can be submitted.
 */
export default defineComponent({
  name: 'TurnstileStub',
  inheritAttrs: false,
  props: {
    siteKey: { type: String, required: true },
  },
  emits: ['update:modelValue'],
  setup(_, { emit, expose }) {
    expose({
      reset: () => {
        emit('update:modelValue', '')
      },
    })
    return () =>
      h('button', {
        type: 'button',
        'data-testid': 'turnstile-stub',
        onClick: () => {
          emit('update:modelValue', 'fake-turnstile-token')
        },
      })
  },
})
