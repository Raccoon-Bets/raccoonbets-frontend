import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/modules/auth'
import { setCookie } from '@/utils/cookieStorage'
import { JWT } from '../util'

describe('auth store cookie persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('hydrates the session from the token cookies', () => {
    setCookie('rb_jwt', JWT)
    setCookie('rb_refresh', 'refresh-token')

    const auth = useAuthStore()
    auth.initializeFromCookies()

    expect(auth.JWT).toBe(JWT)
    expect(auth.refreshToken).toBe('refresh-token')
    expect(auth.loggedIn).toBe(true)
    expect(auth.currentEmail).toBe('sancho@example.com')
  })

  it('treats missing cookies as logged out', () => {
    const auth = useAuthStore()
    auth.initializeFromCookies()

    expect(auth.JWT).toBeNull()
    expect(auth.refreshToken).toBeNull()
    expect(auth.loggedIn).toBe(false)
  })

  it('round-trips tokens through cookies', () => {
    const auth = useAuthStore()
    auth.$patch({ JWT, refreshToken: 'refresh-token' })
    auth.persistToCookies()

    const rehydrated = useAuthStore(createPinia())
    rehydrated.initializeFromCookies()
    expect(rehydrated.JWT).toBe(JWT)
    expect(rehydrated.refreshToken).toBe('refresh-token')
  })

  it('clears the cookies when the session is reset', () => {
    setCookie('rb_jwt', JWT)
    setCookie('rb_refresh', 'refresh-token')

    const auth = useAuthStore()
    auth.initializeFromCookies()
    auth.reset()
    auth.persistToCookies()

    expect(document.cookie).not.toContain('rb_jwt')
    expect(document.cookie).not.toContain('rb_refresh')
  })
})
