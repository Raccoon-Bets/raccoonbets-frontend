import { describe, expect, it, vi } from 'vitest'
import { channelEventSchema, parseChannelMessage } from '@/composables/useChannel'

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
