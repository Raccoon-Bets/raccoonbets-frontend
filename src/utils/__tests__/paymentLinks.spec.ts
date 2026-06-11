import { describe, expect, it } from 'vitest'
import { paymentLinks } from '@/utils/paymentLinks'

const ALL_HANDLES = {
  venmoHandle: 'sam-raccoon',
  paypalHandle: 'samraccoon',
  cashappCashtag: 'samraccoon',
}

describe('paymentLinks', () => {
  it('builds all three links for a USD transfer with every handle set', () => {
    const links = paymentLinks(ALL_HANDLES, 125, 'USD', 'Raccoon Bets — Trash Pandas')

    expect(links.map((link) => link.method)).toEqual(['venmo', 'paypal', 'cashapp'])

    const [venmo, paypal, cashapp] = links
    expect(venmo.href).toBe(
      'https://venmo.com/sam-raccoon?txn=pay&amount=1.25&note=Raccoon+Bets+%E2%80%94+Trash+Pandas',
    )
    expect(venmo.appHref).toBe(
      'venmo://paycharge?txn=pay&recipients=sam-raccoon&amount=1.25&note=Raccoon+Bets+%E2%80%94+Trash+Pandas',
    )
    expect(paypal.href).toBe('https://paypal.me/samraccoon/1.25')
    expect(cashapp.href).toBe('https://cash.app/$samraccoon/1.25')
  })

  it('limits non-USD currencies to PayPal, with the currency code appended', () => {
    const links = paymentLinks(ALL_HANDLES, 500, 'EUR', 'note')

    expect(links.map((link) => link.method)).toEqual(['paypal'])
    expect(links[0].href).toBe('https://paypal.me/samraccoon/5.00EUR')
  })

  it('renders zero-decimal currencies without fraction digits', () => {
    const links = paymentLinks(ALL_HANDLES, 500, 'JPY', 'note')

    expect(links.map((link) => link.method)).toEqual(['paypal'])
    expect(links[0].href).toBe('https://paypal.me/samraccoon/500JPY')
  })

  it('omits methods whose handle is missing', () => {
    const links = paymentLinks(
      { venmoHandle: null, paypalHandle: null, cashappCashtag: 'samraccoon' },
      100,
      'USD',
      'note',
    )

    expect(links.map((link) => link.method)).toEqual(['cashapp'])
  })

  it('returns no links when the payee has no handles', () => {
    expect(
      paymentLinks({ venmoHandle: null, paypalHandle: null, cashappCashtag: null }, 100, 'USD', ''),
    ).toEqual([])
  })
})
