// Builds payment deep links for settle-up transfers. Pure functions: amounts
// arrive as integer minor units and are rendered as decimal strings with the
// currency's fraction digits (Venmo, PayPal, and Cash App all take decimal
// major-unit amounts).
//
// Venmo and Cash App only support USD, so their links are omitted for other
// currencies. PayPal.me accepts any supported currency by appending the ISO
// code to the amount (e.g. `paypal.me/sam/5EUR`).
//
// For Venmo, `href` is the web profile pay link
// (`https://venmo.com/{handle}?txn=pay&...`), chosen over
// `account.venmo.com/pay` because it accepts the recipient, amount, and note
// as plain query parameters and redirects into the app on mobile; `appHref`
// carries the native `venmo://paycharge` scheme for contexts that can open it.

import { fractionDigits, fromMinorUnits } from '@/utils/currency'

/** The payment handles a payee has registered, as delivered by `GET /settle_up`. */
export interface PayeeHandles {
  venmoHandle: string | null
  paypalHandle: string | null
  cashappCashtag: string | null
}

/** A ready-to-render payment link for one method. */
export interface PaymentLink {
  /** The payment service the link opens. */
  method: 'venmo' | 'paypal' | 'cashapp'

  /** The web URL to render as the anchor's href. */
  href: string

  /** A native app deep link, when the service has one (Venmo only). */
  appHref?: string
}

function decimalAmount(amountCents: number, currency: string): string {
  return fromMinorUnits(amountCents, currency).toFixed(fractionDigits(currency))
}

/**
 * Builds the payment links available for paying a transfer's payee. Methods whose handle the
 * payee hasn't registered are omitted; Venmo and Cash App are omitted unless the currency is USD.
 *
 * @param payee The payee's registered payment handles.
 * @param amountCents The amount to pay, in minor units of `currency`.
 * @param currency The ISO 4217 code the amount is denominated in.
 * @param note The note to attach to the payment, where the service supports one.
 * @returns The available links, in Venmo → PayPal → Cash App order.
 */
export function paymentLinks(
  payee: PayeeHandles,
  amountCents: number,
  currency: string,
  note: string,
): PaymentLink[] {
  const amount = decimalAmount(amountCents, currency)
  const links: PaymentLink[] = []

  if (payee.venmoHandle && currency === 'USD') {
    const query = new URLSearchParams({ txn: 'pay', amount, note }).toString()
    links.push({
      method: 'venmo',
      href: `https://venmo.com/${encodeURIComponent(payee.venmoHandle)}?${query}`,
      appHref: `venmo://paycharge?${new URLSearchParams({
        txn: 'pay',
        recipients: payee.venmoHandle,
        amount,
        note,
      }).toString()}`,
    })
  }

  if (payee.paypalHandle) {
    const suffix = currency === 'USD' ? '' : currency
    links.push({
      method: 'paypal',
      href: `https://paypal.me/${encodeURIComponent(payee.paypalHandle)}/${amount}${suffix}`,
    })
  }

  if (payee.cashappCashtag && currency === 'USD') {
    links.push({
      method: 'cashapp',
      href: `https://cash.app/$${encodeURIComponent(payee.cashappCashtag)}/${amount}`,
    })
  }

  return links
}
