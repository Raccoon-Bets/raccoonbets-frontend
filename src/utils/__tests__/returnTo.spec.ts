import { beforeEach, describe, expect, it } from 'vitest'
import { afterAuthRoute, rememberReturnTo } from '@/utils/returnTo'

describe('afterAuthRoute', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('returns the remembered path once, then falls back to the default', () => {
    rememberReturnTo('/members?tab=requests')
    expect(afterAuthRoute()).toBe('/members?tab=requests')
    expect(afterAuthRoute()).toEqual({ name: 'groups' })
  })

  it('discards absolute and protocol-relative destinations', () => {
    rememberReturnTo('https://evil.example.com/phish')
    expect(afterAuthRoute()).toEqual({ name: 'groups' })

    rememberReturnTo('//evil.example.com/phish')
    expect(afterAuthRoute()).toEqual({ name: 'groups' })
  })
})
