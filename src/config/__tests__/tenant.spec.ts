import { describe, expect, it } from 'vitest'
import { parseTenant } from '@/config/tenant'

describe('parseTenant', () => {
  const apex = { isApex: true, groupSlug: null }

  it('treats the apex domain itself as the apex', () => {
    expect(parseTenant('raccoonbets.org', 'raccoonbets.org')).toEqual(apex)
    expect(parseTenant('lvh.me', 'lvh.me')).toEqual(apex)
  })

  it('treats www as the apex', () => {
    expect(parseTenant('www.raccoonbets.org', 'raccoonbets.org')).toEqual(apex)
  })

  it('resolves a single-label subdomain to a group slug', () => {
    expect(parseTenant('trash-pandas.raccoonbets.org', 'raccoonbets.org')).toEqual({
      isApex: false,
      groupSlug: 'trash-pandas',
    })
    expect(parseTenant('poker4.lvh.me', 'lvh.me')).toEqual({
      isApex: false,
      groupSlug: 'poker4',
    })
  })

  it('is case-insensitive and lowercases the slug', () => {
    expect(parseTenant('Trash-Pandas.RaccoonBets.org', 'raccoonbets.org')).toEqual({
      isApex: false,
      groupSlug: 'trash-pandas',
    })
    expect(parseTenant('WWW.raccoonbets.org', 'RaccoonBets.org')).toEqual(apex)
  })

  it.each(['www', 'api', 'ws', 'cable', 'admin'])('rejects the reserved subdomain %s', (label) => {
    expect(parseTenant(`${label}.raccoonbets.org`, 'raccoonbets.org')).toEqual(apex)
  })

  it('rejects multi-label subdomains', () => {
    expect(parseTenant('a.b.raccoonbets.org', 'raccoonbets.org')).toEqual(apex)
    expect(parseTenant('deep.nested.group.lvh.me', 'lvh.me')).toEqual(apex)
  })

  it('rejects labels with characters a slug can never contain', () => {
    expect(parseTenant('trash_pandas.raccoonbets.org', 'raccoonbets.org')).toEqual(apex)
  })

  it('treats foreign hosts as the apex', () => {
    expect(parseTenant('localhost', 'lvh.me')).toEqual(apex)
    expect(parseTenant('example.com', 'raccoonbets.org')).toEqual(apex)
    expect(parseTenant('raccoonbets.org.evil.com', 'raccoonbets.org')).toEqual(apex)
  })

  it('does not treat a suffix-matching host as a subdomain', () => {
    expect(parseTenant('notraccoonbets.org', 'raccoonbets.org')).toEqual(apex)
    expect(parseTenant('evilraccoonbets.org', 'raccoonbets.org')).toEqual(apex)
  })
})
