import { describe, expect, it } from 'vitest'
import { marketPath, slugify } from '@/utils/marketURL'

describe('slugify', () => {
  it('lowercases and hyphenates words', () => {
    expect(slugify('Who wins the Super Bowl?')).toBe('who-wins-the-super-bowl')
  })

  it('strips diacritics', () => {
    expect(slugify('Café Night')).toBe('cafe-night')
  })

  it('collapses runs of separators and trims edges', () => {
    expect(slugify('  Heads -- or  Tails!  ')).toBe('heads-or-tails')
  })

  it('returns an empty string when nothing is slug-able', () => {
    expect(slugify('🎉🎉')).toBe('')
  })
})

describe('marketPath', () => {
  it('formats as {id}-{slug}', () => {
    expect(marketPath({ id: 42, title: 'Who wins?' })).toBe('42-who-wins')
  })

  it('falls back to the bare id for non-sluggable titles', () => {
    expect(marketPath({ id: 7, title: '🎉' })).toBe('7')
  })
})
