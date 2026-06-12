import { describe, expect, it } from 'vitest'
import { countdownParts, urgency } from '@/composables/useCountdown'

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

describe('urgency', () => {
  it('is normal at and above 24 hours', () => {
    expect(urgency(DAY)).toBe('normal')
    expect(urgency(2 * DAY)).toBe('normal')
  })

  it('is warning under 24 hours down to exactly 1 hour', () => {
    expect(urgency(DAY - 1)).toBe('warning')
    expect(urgency(HOUR)).toBe('warning')
  })

  it('is alert under 1 hour', () => {
    expect(urgency(HOUR - 1)).toBe('alert')
    expect(urgency(MINUTE)).toBe('alert')
    expect(urgency(0)).toBe('alert')
  })
})
