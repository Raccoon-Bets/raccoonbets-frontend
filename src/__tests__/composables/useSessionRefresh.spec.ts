import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import useSessionRefresh from '@/composables/useSessionRefresh'
import { useAuthStore } from '@/stores/modules/auth'

const refreshSession = vi.hoisted(() => vi.fn())
vi.mock('@/stores/modules/root', () => ({ refreshSession }))

// A well-formed access token whose `exp` is `expiresInMs` from the (faked) now.
function tokenExpiringIn(expiresInMs: number): string {
  const exp = Math.floor((Date.now() + expiresInMs) / 1000)
  return `header.${btoa(JSON.stringify({ exp, e: 'sancho@example.com' }))}.signature`
}

const Host = defineComponent({
  setup() {
    useSessionRefresh()
    return () => h('div')
  },
})

function mountWith(initial: { JWT?: string; refreshToken?: string }) {
  const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn })
  useAuthStore(pinia).$patch(initial)
  mount(Host, { global: { plugins: [pinia] } })
}

describe('useSessionRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    refreshSession.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshes ahead of the access token expiry', () => {
    mountWith({ JWT: tokenExpiringIn(5 * 60_000), refreshToken: 'refresh' })

    // Scheduled for expiry minus the 60s lead (~4 minutes out).
    vi.advanceTimersByTime(3 * 60_000)
    expect(refreshSession).not.toHaveBeenCalled()

    vi.advanceTimersByTime(2 * 60_000)
    expect(refreshSession).toHaveBeenCalledOnce()
  })

  it('does not schedule a refresh while logged out', () => {
    mountWith({})

    vi.advanceTimersByTime(60 * 60_000)
    expect(refreshSession).not.toHaveBeenCalled()
  })
})
