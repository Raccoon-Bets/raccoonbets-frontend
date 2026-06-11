// Display-side currency helpers. The frontend never does money arithmetic —
// amounts are integer minor units throughout — but form inputs are friendlier
// as decimal major units, so these convert at the form boundary.

// Default amount limits in minor units for a currency with 100 subunits per
// unit; mirrors the backend's Group::DEFAULT_MIN_AMOUNT_CENTS /
// DEFAULT_MAX_AMOUNT_CENTS (used here only for placeholder text).
const DEFAULT_MIN_AMOUNT_CENTS = 25
const DEFAULT_MAX_AMOUNT_CENTS = 2000

/**
 * The number of decimal digits a currency's minor unit uses (2 for USD, 0 for JPY, 3 for TND),
 * per the runtime's CLDR data.
 *
 * @param currency An ISO 4217 currency code.
 * @returns The currency's fraction digits.
 */
export function fractionDigits(currency: string): number {
  // maximumFractionDigits is always resolved for currency style; the lib type
  // marks it optional only because compact notation may omit it.
  return (
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  )
}

/**
 * The currency's symbol for use as an input prefix (e.g. `$` for USD, `£` for GBP, `¥` for
 * JPY, `CA$` for CAD). Uses the disambiguating symbol rather than the narrow one so the
 * several dollar currencies the app offers don't all collapse to a bare `$`. Falls back to
 * the ISO code when the runtime resolves no distinct symbol.
 *
 * @param currency An ISO 4217 currency code.
 * @returns The currency symbol.
 */
export function currencySymbol(currency: string): string {
  const parts = new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
  }).formatToParts(0)
  return parts.find((part) => part.type === 'currency')?.value ?? currency
}

/**
 * Converts a decimal major-unit amount to integer minor units (e.g. `1.25` USD → `125`).
 *
 * @param amount The amount in major units.
 * @param currency The ISO 4217 currency code.
 * @returns The amount in minor units, rounded to the nearest integer.
 */
export function toMinorUnits(amount: number, currency: string): number {
  return Math.round(amount * 10 ** fractionDigits(currency))
}

/**
 * Converts integer minor units to a decimal major-unit amount (e.g. `125` USD → `1.25`).
 *
 * @param minorUnits The amount in minor units.
 * @param currency The ISO 4217 currency code.
 * @returns The amount in major units.
 */
export function fromMinorUnits(minorUnits: number, currency: string): number {
  return minorUnits / 10 ** fractionDigits(currency)
}

/**
 * The default amount limits a new group gets when none are specified, in minor units. Mirrors the
 * backend's per-currency scaling so zero-decimal currencies like JPY default to ¥25–¥2,000.
 *
 * @param currency The ISO 4217 currency code.
 * @returns The default minimum and maximum amounts in minor units.
 */
export function defaultAmountRange(currency: string): { minCents: number; maxCents: number } {
  const scale = Math.ceil(10 ** fractionDigits(currency) / 100)
  return {
    minCents: DEFAULT_MIN_AMOUNT_CENTS * scale,
    maxCents: DEFAULT_MAX_AMOUNT_CENTS * scale,
  }
}
