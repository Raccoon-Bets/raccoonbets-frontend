import { describe, expect, it } from 'vitest'
import {
  getCookie,
  parseCookieValue,
  removeCookie,
  serializeCookie,
  setCookie,
} from '@/utils/cookieStorage'

describe('serializeCookie', () => {
  it('scopes the cookie to the apex domain with path and SameSite', () => {
    const cookie = serializeCookie('rb_jwt', 'token', {
      domain: 'raccoonbets.org',
      secure: false,
      maxAge: 3600,
    })
    expect(cookie).toBe('rb_jwt=token; Domain=.raccoonbets.org; Path=/; Max-Age=3600; SameSite=Lax')
  })

  it('appends Secure only when requested', () => {
    const secure = serializeCookie('rb_jwt', 'token', {
      domain: 'raccoonbets.org',
      secure: true,
      maxAge: 3600,
    })
    expect(secure).toMatch(/; Secure$/)

    const insecure = serializeCookie('rb_jwt', 'token', {
      domain: 'lvh.me',
      secure: false,
      maxAge: 3600,
    })
    expect(insecure).not.toContain('Secure')
  })

  it('URI-encodes the value', () => {
    const cookie = serializeCookie('rb_jwt', 'a;b=c d', {
      domain: 'lvh.me',
      secure: false,
      maxAge: 60,
    })
    expect(cookie.startsWith('rb_jwt=a%3Bb%3Dc%20d; ')).toBe(true)
  })
})

describe('parseCookieValue', () => {
  it('finds a cookie among several', () => {
    expect(parseCookieValue('a=1; rb_jwt=token; b=2', 'rb_jwt')).toBe('token')
  })

  it('returns null when the cookie is absent', () => {
    expect(parseCookieValue('a=1; b=2', 'rb_jwt')).toBeNull()
    expect(parseCookieValue('', 'rb_jwt')).toBeNull()
  })

  it('does not match a cookie whose name is a suffix', () => {
    expect(parseCookieValue('xrb_jwt=wrong', 'rb_jwt')).toBeNull()
  })

  it('decodes URI-encoded values', () => {
    expect(parseCookieValue('rb_jwt=a%3Bb%3Dc%20d', 'rb_jwt')).toBe('a;b=c d')
  })

  it('preserves = signs inside the value', () => {
    expect(parseCookieValue('rb_jwt=abc==', 'rb_jwt')).toBe('abc==')
  })
})

describe('setCookie / getCookie / removeCookie', () => {
  it('round-trips a value through document.cookie', () => {
    setCookie('rb_jwt', 'header.payload.signature')
    expect(getCookie('rb_jwt')).toBe('header.payload.signature')
  })

  it('overwrites an existing value', () => {
    setCookie('rb_jwt', 'old')
    setCookie('rb_jwt', 'new')
    expect(getCookie('rb_jwt')).toBe('new')
  })

  it('removes a cookie', () => {
    setCookie('rb_jwt', 'token')
    removeCookie('rb_jwt')
    expect(getCookie('rb_jwt')).toBeNull()
  })
})
