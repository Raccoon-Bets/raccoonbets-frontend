import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { requestJSON } from '@/stores/modules/root'
import { useAuthStore } from '@/stores/modules/auth'
import { removeCookie, setCookie } from '@/utils/cookieStorage'
import { JWT } from '../util'

type FetchFn = (input: string, init: RequestInit) => Promise<Response>

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const authHeaderOf = (init: RequestInit): string | undefined =>
  (init.headers as Record<string, string>).Authorization

describe('request refresh-and-retry', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().$patch({ JWT: 'old.jwt.token', refreshToken: 'old-refresh' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    removeCookie('rb_jwt')
    removeCookie('rb_refresh')
  })

  it('refreshes the access token and replays the original request on 401', async () => {
    const fetchMock = vi
      .fn<FetchFn>()
      .mockResolvedValueOnce(jsonResponse(401, { error: 'expired JWT access token' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { access_token: 'new.jwt.token', refresh_token: 'new-refresh' }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { name: 'Sancho' }))
    vi.stubGlobal('fetch', fetchMock)

    const auth = useAuthStore()
    const result = await requestJSON<{ name: string }>({ path: '/account' })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.val.body).toEqual({ name: 'Sancho' })

    // The session survives and adopts the rotated tokens.
    expect(auth.JWT).toBe('new.jwt.token')
    expect(auth.refreshToken).toBe('new-refresh')

    // Original (expired) → /jwt-refresh → retry with the new token.
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1][0]).toContain('/jwt-refresh')
    expect(authHeaderOf(fetchMock.mock.calls[2][1])).toBe('Bearer new.jwt.token')
  })

  it('refreshes only once when several requests hit a 401 concurrently', async () => {
    const fetchMock = vi.fn<FetchFn>((url, init) => {
      if (url.includes('/jwt-refresh')) {
        return Promise.resolve(
          jsonResponse(200, { access_token: 'new.jwt.token', refresh_token: 'new-refresh' }),
        )
      }
      if (authHeaderOf(init) === 'Bearer old.jwt.token') {
        return Promise.resolve(jsonResponse(401, { error: 'expired JWT access token' }))
      }
      return Promise.resolve(jsonResponse(200, { ok: true }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const [a, b] = await Promise.all([
      requestJSON({ path: '/account' }),
      requestJSON({ path: '/groups/trash-pandas/markets' }),
    ])

    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    const refreshCalls = fetchMock.mock.calls.filter(([url]) => url.includes('/jwt-refresh'))
    expect(refreshCalls).toHaveLength(1)
  })

  it('resets auth when the refresh token is also rejected', async () => {
    const fetchMock = vi.fn<FetchFn>((url) =>
      Promise.resolve(
        url.includes('/jwt-refresh')
          ? jsonResponse(401, { error: 'invalid JWT refresh token' })
          : jsonResponse(401, { error: 'expired JWT access token' }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const auth = useAuthStore()
    // The request promise is intentionally never settled once auth is reset,
    // so observe the side effect rather than awaiting it.
    requestJSON({ path: '/account' }).catch(() => undefined)

    await vi.waitFor(() => {
      expect(auth.JWT).toBeNull()
    })
    const refreshCalls = fetchMock.mock.calls.filter(([url]) => url.includes('/jwt-refresh'))
    expect(refreshCalls).toHaveLength(1)
  })

  it("adopts a sibling tab's refreshed token from the cookie instead of spending its own", async () => {
    // A sibling tab (or subdomain) already rotated the shared single-use refresh
    // token and wrote the fresh pair to the apex cookie; this tab still holds the
    // stale in-memory copy and must not re-spend it (which Rodauth would reject,
    // logging this tab out).
    setCookie('rb_jwt', JWT)
    setCookie('rb_refresh', 'sibling-refresh')

    const fetchMock = vi.fn<FetchFn>((_url, init) =>
      Promise.resolve(
        authHeaderOf(init) === 'Bearer old.jwt.token'
          ? jsonResponse(401, { error: 'expired JWT access token' })
          : jsonResponse(200, { ok: true }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const auth = useAuthStore()
    const result = await requestJSON({ path: '/account' })

    expect(result.ok).toBe(true)
    // The sibling's token was adopted, so no refresh was spent...
    expect(fetchMock.mock.calls.some(([url]) => url.includes('/jwt-refresh'))).toBe(false)
    // ...and the original request replayed with the adopted session.
    expect(auth.JWT).toBe(JWT)
    expect(auth.refreshToken).toBe('sibling-refresh')
  })

  it('drops the dead session and loads public content anonymously', async () => {
    const fetchMock = vi.fn<FetchFn>((url, init) => {
      if (url.includes('/jwt-refresh')) {
        return Promise.resolve(jsonResponse(401, { error: 'invalid JWT refresh token' }))
      }
      // The expired token is rejected; the same endpoint serves public data
      // once the request is made without credentials.
      if (authHeaderOf(init)) {
        return Promise.resolve(jsonResponse(401, { error: 'expired JWT access token' }))
      }
      return Promise.resolve(jsonResponse(200, { available: true }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const auth = useAuthStore()
    const result = await requestJSON<{ available: boolean }>({
      path: '/groups/availability?subdomain=trash-pandas',
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.val.body).toEqual({ available: true })

    // The lapsed session is cleared and the recovering request carried no token.
    expect(auth.JWT).toBeNull()
    const lastInit = fetchMock.mock.calls.at(-1)?.[1]
    expect(lastInit && authHeaderOf(lastInit)).toBeUndefined()
  })
})
