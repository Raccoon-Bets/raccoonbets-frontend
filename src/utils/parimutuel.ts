/**
 * The parimutuel payout factor for an outcome: what a winning amount is
 * multiplied by if this outcome wins (total pool ÷ outcome pool).
 *
 * @param totalPoolCents The market's total pool in minor units.
 * @param outcomePoolCents The outcome's pool in minor units.
 * @returns The multiplier, or `null` when the outcome pool is empty.
 */
export function payoutMultiplier(totalPoolCents: number, outcomePoolCents: number): number | null {
  if (outcomePoolCents <= 0) return null
  return totalPoolCents / outcomePoolCents
}

/**
 * Formats a payout multiplier for display (e.g. `1.6×`), localized to at most
 * one decimal place.
 *
 * @param multiplier The factor from {@link payoutMultiplier}.
 * @param locale The BCP 47 locale used for number formatting.
 * @returns The formatted multiplier string.
 */
export function formatMultiplier(multiplier: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(multiplier)}×`
}
