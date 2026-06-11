import { describe, expect, it } from 'vitest'
import { countdownParts } from '@/composables/useCountdown'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('countdownParts', () => {
  it('returns null at and past the deadline', () => {
    expect(countdownParts(0)).toBeNull()
    expect(countdownParts(-1)).toBeNull()
  })

  it('rounds partial minutes up so time remaining never reads 0m', () => {
    expect(countdownParts(1)).toEqual({ days: 0, hours: 0, minutes: 1 })
    expect(countdownParts(MINUTE)).toEqual({ days: 0, hours: 0, minutes: 1 })
    expect(countdownParts(MINUTE + 1)).toEqual({ days: 0, hours: 0, minutes: 2 })
  })

  it('carries minutes into hours and days at exact boundaries', () => {
    expect(countdownParts(HOUR)).toEqual({ days: 0, hours: 1, minutes: 0 })
    expect(countdownParts(DAY)).toEqual({ days: 1, hours: 0, minutes: 0 })
    expect(countdownParts(DAY + 2 * HOUR + 30 * MINUTE)).toEqual({
      days: 1,
      hours: 2,
      minutes: 30,
    })
  })
})
