import { computed, type ComputedRef } from 'vue'
import { global } from '@/i18n'

interface ReturnType {
  dateFormat: ComputedRef<string>
  hourFormat: ComputedRef<'12' | '24'>
}

/**
 * Derives PrimeVue DatePicker format props from the active vue-i18n locale via Intl, so the
 * picker's input reads in the user's own date and time conventions rather than a hardcoded ISO
 * format. Recomputes when the locale changes.
 *
 * @returns `dateFormat` (PrimeVue day/month/year tokens, e.g. `mm/dd/yy` for en-US) and
 * `hourFormat` (`'12'` or `'24'`).
 */
export default function useDatePickerFormat(): ReturnType {
  const dateFormat = computed(() => primevueDateFormat(global.locale.value))
  const hourFormat = computed<'12' | '24'>(() =>
    new Intl.DateTimeFormat(global.locale.value, { hour: 'numeric' }).resolvedOptions().hour12
      ? '12'
      : '24',
  )
  return { dateFormat, hourFormat }
}

// Maps the locale's date-part order to PrimeVue tokens (`dd`, `mm`, `yy` = four-digit year),
// preserving the locale's own separators.
function primevueDateFormat(locale: string): string {
  const sample = new Date(Date.UTC(2026, 0, 2))
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC' })
    .formatToParts(sample)
    .map((part) => {
      switch (part.type) {
        case 'day':
          return 'dd'
        case 'month':
          return 'mm'
        case 'year':
          return 'yy'
        case 'literal':
          return part.value
        default:
          return ''
      }
    })
    .join('')
}
