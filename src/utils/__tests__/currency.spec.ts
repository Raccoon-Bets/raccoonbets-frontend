import { describe, expect, it } from 'vitest'
import {
  currencySymbol,
  defaultAmountRange,
  fractionDigits,
  fromMinorUnits,
  toMinorUnits,
} from '@/utils/currency'

describe('fractionDigits', () => {
  it('reports two digits for USD and zero for JPY', () => {
    expect(fractionDigits('USD')).toBe(2)
    expect(fractionDigits('JPY')).toBe(0)
  })
})

describe('currencySymbol', () => {
  it('returns the symbol for common currencies', () => {
    expect(currencySymbol('USD')).toBe('$')
    expect(currencySymbol('GBP')).toBe('£')
    expect(currencySymbol('JPY')).toBe('¥')
  })

  it('disambiguates the dollar currencies instead of collapsing them to a bare $', () => {
    expect(currencySymbol('CAD')).toBe('CA$')
    expect(currencySymbol('AUD')).toBe('A$')
  })
})

describe('toMinorUnits', () => {
  it('converts decimal amounts without floating-point drift', () => {
    expect(toMinorUnits(20.15, 'USD')).toBe(2015)
    expect(toMinorUnits(0.25, 'USD')).toBe(25)
  })

  it('treats zero-decimal currencies as already minor units', () => {
    expect(toMinorUnits(500, 'JPY')).toBe(500)
  })
})

describe('fromMinorUnits', () => {
  it('converts minor units back to decimal major units', () => {
    expect(fromMinorUnits(2015, 'USD')).toBe(20.15)
    expect(fromMinorUnits(500, 'JPY')).toBe(500)
  })
})

describe('defaultAmountRange', () => {
  it('matches the backend defaults for two-decimal currencies', () => {
    expect(defaultAmountRange('USD')).toEqual({ minCents: 25, maxCents: 2000 })
  })

  it('scales by subunit ratio like the backend', () => {
    // JPY has no subunits, so the defaults stay ¥25–¥2,000.
    expect(defaultAmountRange('JPY')).toEqual({ minCents: 25, maxCents: 2000 })
    // TND has 1000 millimes per dinar, so the defaults scale ×10.
    expect(defaultAmountRange('TND')).toEqual({ minCents: 250, maxCents: 20000 })
  })
})
