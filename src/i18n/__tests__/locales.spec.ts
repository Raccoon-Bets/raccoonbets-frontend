import { beforeEach, describe, expect, it } from 'vitest'
import { detectLocale, matchLocale } from '@/i18n/locales'

function setBrowserLanguages(languages: string[]) {
  Object.defineProperty(navigator, 'languages', { value: languages, configurable: true })
  Object.defineProperty(navigator, 'language', { value: languages[0] ?? '', configurable: true })
}

describe('matchLocale', () => {
  it('matches a supported locale exactly, case-insensitively', () => {
    expect(matchLocale('en')).toBe('en')
    expect(matchLocale('EN')).toBe('en')
  })

  it('collapses regional variants to their base language', () => {
    expect(matchLocale('en-NZ')).toBe('en')
    expect(matchLocale('en-US')).toBe('en')
  })

  it('returns null for an unsupported language', () => {
    expect(matchLocale('es-ES')).toBeNull()
  })
})

describe('detectLocale', () => {
  beforeEach(() => {
    localStorage.clear()
    setBrowserLanguages([])
  })

  it('prefers a stored preference over browser languages', () => {
    localStorage.setItem('locale', 'en-GB')
    setBrowserLanguages(['es-ES'])
    expect(detectLocale()).toBe('en')
  })

  it('ignores an unsupported stored value and falls back to the browser', () => {
    localStorage.setItem('locale', 'es-ES')
    setBrowserLanguages(['en-AU'])
    expect(detectLocale()).toBe('en')
  })

  it('defaults to en when no preference is supported', () => {
    setBrowserLanguages(['es-ES', 'ja-JP'])
    expect(detectLocale()).toBe('en')
  })
})
