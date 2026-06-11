import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import config from '@/config'
import { useAccountStore } from '@/stores/modules/account'
import { useAuthStore } from '@/stores/modules/auth'

describe('account store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('signUp', () => {
    it('does not set tokens or user on success', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      vi.stubGlobal('fetch', fetchMock)

      const account = useAccountStore()
      const auth = useAuthStore()
      const result = await account.signUp({
        login: 'sancho@example.com',
        password: 'hunter2hunter2',
        name: 'Sancho',
        locale: 'en',
        turnstile_token: 'test-token',
      })

      expect(result.ok).toBe(true)
      expect(auth.JWT).toBeNull()
      expect(account.currentUser).toBeNull()
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/signup'),
        expect.objectContaining({ method: 'post' }),
      )
    })

    it('returns validation errors on 422', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ errors: { login: ['is taken'] } }), {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      )

      const account = useAccountStore()
      const result = await account.signUp({
        login: 'sancho@example.com',
        password: 'hunter2hunter2',
        name: 'Sancho',
        locale: 'en',
        turnstile_token: 'test-token',
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.val).toEqual({ login: ['is taken'] })
      }
    })
  })

  describe('verifyAccount', () => {
    it('POSTs the key to /verify-account and returns Ok on success', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      vi.stubGlobal('fetch', fetchMock)

      const account = useAccountStore()
      const result = await account.verifyAccount('the-key')

      expect(result.ok).toBe(true)
      expect(fetchMock).toHaveBeenCalledWith(
        `${config.APIURL}/verify-account`,
        expect.objectContaining({
          method: 'post',
          body: JSON.stringify({ key: 'the-key' }),
        }),
      )
    })

    it('returns validation errors when the key is invalid', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ 'field-error': ['key', 'is invalid'] }), {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      )

      const account = useAccountStore()
      const result = await account.verifyAccount('bad-key')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.val).toEqual({ key: ['is invalid'] })
      }
    })
  })
})
