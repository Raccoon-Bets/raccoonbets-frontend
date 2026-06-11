/** The locales the app ships translations (or locale-specific formats) for. */
export const SUPPORTED_LOCALES = ['en'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

/** The locale used when nothing else matches, and the source for fallback translations. */
export const DEFAULT_LOCALE: SupportedLocale = 'en'

const localStorageKey = 'locale'

/**
 * Resolves an arbitrary BCP-47 language tag to a {@link SupportedLocale}. An exact match wins;
 * otherwise the first supported locale sharing the base language (e.g. `en-NZ` → `en`) is used.
 *
 * @param tag A BCP-47 language tag such as `en-US`, `de`, or `fr-CA`.
 * @returns The best-matching supported locale, or `null` if none matches.
 */
export function matchLocale(tag: string): SupportedLocale | null {
  const normalized = tag.toLowerCase()
  const exact = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === normalized)
  if (exact) return exact

  const base = normalized.split('-')[0]
  return SUPPORTED_LOCALES.find((locale) => locale.toLowerCase().split('-')[0] === base) ?? null
}

/**
 * Determines the locale from (in order) a stored user preference, the browser's preferred
 * languages, and finally {@link DEFAULT_LOCALE}.
 */
export function detectLocale(): SupportedLocale {
  const stored = localStorage.getItem(localStorageKey)
  if (stored) {
    const matched = matchLocale(stored)
    if (matched) return matched
  }

  for (const tag of navigator.languages) {
    const matched = matchLocale(tag)
    if (matched) return matched
  }

  return DEFAULT_LOCALE
}
