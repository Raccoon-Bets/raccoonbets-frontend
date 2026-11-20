import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePasskeysStore } from '@/stores/modules/passkeys'
import { useAuthStore } from '@/stores/modules/auth'
import { JWT } from '../util'

vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: vi.fn(() => Promise.resolve({ id: 'credential-id' })),
  startRegistration: vi.fn(() => Promise.resolve({ id: 'credential-id' })),
}))

type FetchFn = (input: string, init: RequestInit) => Promise<Response>

const CHALLENGE_TOKEN = 'challenge.jwt.token'

const USER = { name: 'Sancho', email: 'sancho@example.com', passkeys: [] }

const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

// Rodauth answers an options request with a 4xx holding the options, plus the
// JWT its challenge is bound to.
const optionsResponse = (options: Record<string, unknown>): Response =>
  jsonResponse(401, { error: 'options only', ...options }, { Authorization: CHALLENGE_TOKEN })

const authHeaderOf = (init: RequestInit): string | undefined =>
  (init.headers as Record<string, string>).Authorization

const bodyOf = (init: RequestInit): Record<string, unknown> =>
  JSON.parse(init.body as string) as Record<string, unknown>

// Answers the ceremony's options request, then its completing request.
function stubCeremony(
  path: string,
  options: Record<string, unknown>,
  completion: () => Response,
): ReturnType<typeof vi.fn<FetchFn>> {
  const fetchMock = vi.fn<FetchFn>((url, init) => {
    if (!url.endsWith(path)) return Promise.resolve(jsonResponse(200, USER))
    const isOptionsRequest = Object.keys(bodyOf(init)).length === 0
    return Promise.resolve(isOptionsRequest ? optionsResponse(options) : completion())
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const completingRequestOf = (fetchMock: ReturnType<typeof vi.fn<FetchFn>>, path: string) =>
  fetchMock.mock.calls.filter(([url]) => url.endsWith(path))[1][1]

describe('passkeys store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('completes a passkey login with the challenge token without adopting it as the session', async () => {
    const fetchMock = stubCeremony(
      '/webauthn-login',
      {
        webauthn_auth: { challenge: 'challenge' },
        webauthn_auth_challenge: 'challenge',
        webauthn_auth_challenge_hmac: 'hmac',
      },
      () => jsonResponse(200, { ...USER, refresh_token: 'refresh' }, { Authorization: JWT }),
    )

    const result = await usePasskeysStore().logIn({ useBrowserAutofill: false })

    expect(result.ok).toBe(true)
    expect(authHeaderOf(completingRequestOf(fetchMock, '/webauthn-login'))).toBe(
      `Bearer ${CHALLENGE_TOKEN}`,
    )
    const auth = useAuthStore()
    expect(auth.JWT).toBe(JWT)
    expect(auth.refreshToken).toBe('refresh')
  })

  it('throws when Rodauth provides no login options', async () => {
    stubCeremony('/webauthn-login', {}, () => jsonResponse(200, USER))

    await expect(usePasskeysStore().logIn({ useBrowserAutofill: true })).rejects.toThrow(
      'Missing WebAuthn login options',
    )
  })

  it('completes passkey registration with the challenge token', async () => {
    const auth = useAuthStore()
    auth.$patch({ JWT, refreshToken: 'refresh' })
    const fetchMock = stubCeremony(
      '/webauthn-setup',
      {
        webauthn_setup: { challenge: 'challenge' },
        webauthn_setup_challenge: 'challenge',
        webauthn_setup_challenge_hmac: 'hmac',
      },
      () => jsonResponse(200, {}),
    )

    const result = await usePasskeysStore().register('password', 'Phone')

    expect(result.ok).toBe(true)
    expect(authHeaderOf(completingRequestOf(fetchMock, '/webauthn-setup'))).toBe(
      `Bearer ${CHALLENGE_TOKEN}`,
    )
    expect(auth.JWT).toBe(JWT)
  })
})
