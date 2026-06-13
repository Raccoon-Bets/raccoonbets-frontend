import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createMemoryHistory, createRouter } from 'vue-router'
import requireAuth from '@/composables/requireAuth'
import { useAuthStore } from '@/stores/modules/auth'
import type { AuthState } from '@/stores/types'
import { JWT } from '../util'

type FetchFn = (input: string, init: RequestInit) => Promise<Response>

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

// A well-formed access token whose `exp` is in the past — the 15-minute access
// token has lapsed while the refresh token (held in the store) is still good.
const EXPIRED_JWT = `header.${btoa(JSON.stringify({ exp: 1000000000, e: 'sancho@example.com' }))}.signature`

const Host = defineComponent({
  setup() {
    requireAuth()
    return () => h('div')
  },
})

function mountGuard(initial: Partial<AuthState>) {
  const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn })
  const auth = useAuthStore(pinia)
  auth.$patch(initial)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'feed', component: Host },
      { path: '/login', name: 'logIn', component: { template: '<div />' } },
    ],
  })
  const push = vi.spyOn(router, 'push')

  mount(Host, { global: { plugins: [pinia, router] } })
  return { auth, push }
}

describe('requireAuth', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('refreshes an expired-but-refreshable session instead of redirecting to login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchFn>((url) =>
        Promise.resolve(
          url.includes('/jwt-refresh')
            ? jsonResponse(200, { access_token: JWT, refresh_token: 'new-refresh' })
            : jsonResponse(401, { error: 'expired JWT access token' }),
        ),
      ),
    )

    const { auth, push } = mountGuard({ JWT: EXPIRED_JWT, refreshToken: 'old-refresh' })

    await flushPromises()

    expect(auth.loggedIn).toBe(true)
    expect(auth.JWT).toBe(JWT)
    expect(push).not.toHaveBeenCalledWith({ name: 'logIn' })
  })

  it('redirects to login when the refresh token is also spent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchFn>(() =>
        Promise.resolve(jsonResponse(401, { error: 'invalid JWT refresh token' })),
      ),
    )

    const { auth, push } = mountGuard({ JWT: EXPIRED_JWT, refreshToken: 'old-refresh' })

    await flushPromises()

    expect(auth.loggedIn).toBe(false)
    expect(push).toHaveBeenCalledWith({ name: 'logIn' })
  })
})
