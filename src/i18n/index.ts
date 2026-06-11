import { createI18n } from 'vue-i18n'
import messages from '@/i18n/messages'
import numberFormats from '@/i18n/numberFormats'
import dateTimeFormats from '@/i18n/dateTimeFormats'
import { DEFAULT_LOCALE, detectLocale, type SupportedLocale } from '@/i18n/locales'

const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages,
  numberFormats,
  datetimeFormats: dateTimeFormats,
  silentFallbackWarn: true,
  silentTranslationWarn: true,
})

export default i18n
export const { global } = i18n

/**
 * Activates a locale: switches vue-i18n and reflects the choice on `<html lang>`. When a locale
 * with a code-split catalog is added, this is where it gets lazy-loaded before the switch.
 */
export function applyLocale(locale: SupportedLocale): void {
  global.locale.value = locale
  document.documentElement.setAttribute('lang', locale)
}

/** Resolves and applies the initial locale from storage / browser preferences. */
export function initLocale(): void {
  applyLocale(detectLocale())
}
