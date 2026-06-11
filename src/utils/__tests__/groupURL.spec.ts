import { describe, expect, it } from 'vitest'
import { buildGroupURL } from '@/utils/groupURL'

describe('buildGroupURL', () => {
  it('preserves the current port in development', () => {
    expect(buildGroupURL('trash-pandas', 'lvh.me', 'http:', '5173')).toBe(
      'http://trash-pandas.lvh.me:5173/',
    )
  })

  it('omits the port suffix on default ports', () => {
    expect(buildGroupURL('den', 'raccoonbets.org', 'https:', '')).toBe(
      'https://den.raccoonbets.org/',
    )
  })
})
