import { global } from '@/i18n'
import { fromMinorUnits } from '@/utils/currency'

interface ReturnType {
  format: (cents: number, currency: string) => string
}

/**
 * Formats integer minor-unit amounts as localized currency strings. Reads the active vue-i18n
 * locale on every call, so templates re-render formatted amounts when the locale changes.
 *
 * @returns A `format` function taking minor units and an ISO 4217 currency code (e.g.
 * `format(125, 'USD')` → `$1.25`, `format(500, 'JPY')` → `¥500`).
 */
export default function useMoney(): ReturnType {
  function format(cents: number, currency: string): string {
    return new Intl.NumberFormat(global.locale.value, { style: 'currency', currency }).format(
      fromMinorUnits(cents, currency),
    )
  }

  return { format }
}
