import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import type { Consumer } from '@rails/actioncable'
import useChannel, { channelEventSchema, parseChannelMessage } from '@/composables/useChannel'
import { useAuthStore } from '@/stores/modules/auth'

describe('parseChannelMessage', () => {
  it('parses a conforming payload, extra fields included', () => {
    const message = parseChannelMessage(channelEventSchema, {
      type: 'position_changed',
      market_id: 7,
      total_pool_cents: 450,
    })
    expect(message).toEqual({ type: 'position_changed', market_id: 7, total_pool_cents: 450 })
  })

  it('returns null for a non-conforming payload', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(parseChannelMessage(channelEventSchema, { market_id: 7 })).toBeNull()
    expect(parseChannelMessage(channelEventSchema, 'pong')).toBeNull()
    vi.restoreAllMocks()
  })
})

describe('useChannel', () => {
  // Mounts a component subscribed to MarketChannel for the market whose route param is `slug`,
  // returning the consumer's subscription spies.
  function subscribeToMarket(slug: ReturnType<typeof ref<string>>) {
    const unsubscribe = vi.fn()
    const create = vi.fn(() => ({ unsubscribe }))
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const auth = useAuthStore(pinia)
    auth.actionCableConsumer = { subscriptions: { create } } as unknown as Consumer
    vi.mocked(auth.connectActionCable).mockResolvedValue()

    const Host = defineComponent({
      setup() {
        useChannel({
          channel: 'MarketChannel',
          params: () => ({ id: Number.parseInt(slug.value ?? '', 10) }),
          schema: channelEventSchema,
          received: () => undefined,
        })
        return () => h('div')
      },
    })
    mount(Host, { global: { plugins: [pinia] } })
    return { create, unsubscribe }
  }

  it('keeps the subscription when params re-evaluate to the same values', async () => {
    const slug = ref('7')
    const { create, unsubscribe } = subscribeToMarket(slug)

    slug.value = '7-which-happens-first'
    await nextTick()

    expect(create).toHaveBeenCalledOnce()
    expect(unsubscribe).not.toHaveBeenCalled()
  })

  it('resubscribes when the params change', async () => {
    const slug = ref('7')
    const { create, unsubscribe } = subscribeToMarket(slug)

    slug.value = '8'
    await nextTick()

    expect(create).toHaveBeenCalledTimes(2)
    expect(create).toHaveBeenLastCalledWith({ channel: 'MarketChannel', id: 8 }, expect.anything())
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
