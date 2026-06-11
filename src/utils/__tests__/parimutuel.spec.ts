import { describe, expect, it } from 'vitest'
import { formatMultiplier, payoutMultiplier } from '@/utils/parimutuel'

describe('payoutMultiplier', () => {
  it('returns total pool over outcome pool', () => {
    expect(payoutMultiplier(1400, 900)).toBeCloseTo(1.5556, 4)
  })

  it('returns null for an empty outcome pool', () => {
    expect(payoutMultiplier(1400, 0)).toBeNull()
  })
})

describe('formatMultiplier', () => {
  it('formats to one decimal place with a multiplication sign', () => {
    expect(formatMultiplier(1.5556, 'en')).toBe('1.6×')
  })

  it('drops a trailing zero decimal', () => {
    expect(formatMultiplier(4, 'en')).toBe('4×')
  })
})
