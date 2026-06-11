import { describe, expect, it } from 'vitest'
import useMoney from '@/composables/useMoney'

const { format } = useMoney()

describe('useMoney', () => {
  it('formats minor units as localized currency', () => {
    expect(format(125, 'USD')).toBe('$1.25')
    expect(format(2015, 'USD')).toBe('$20.15')
  })

  it('treats zero-decimal currencies as whole units', () => {
    expect(format(500, 'JPY')).toBe('¥500')
  })

  it('handles three-decimal currencies', () => {
    expect(format(1500, 'TND')).toBe('TND 1.500')
  })

  it('formats negative amounts', () => {
    expect(format(-125, 'USD')).toBe('-$1.25')
  })
})
