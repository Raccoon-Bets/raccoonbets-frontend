import { describe, expect, it } from 'vitest'
import { groupShowFromJSON } from '@/stores/coding'

// The group show endpoint returns two different shapes — the full group for
// members and a minimal preview for other authenticated users — and the whole
// subdomain boot (feed vs. join screen) hangs on telling them apart.
describe('groupShowFromJSON', () => {
  it('parses the full member representation', () => {
    const result = groupShowFromJSON({
      name: 'Trash Pandas',
      subdomain: 'trash-pandas',
      currency: 'USD',
      min_amount_cents: 25,
      max_amount_cents: 2000,
      status: 'active',
      membership: { id: 7, role: 'admin' },
    })

    expect(result.member).toBe(true)
    if (!result.member) return
    expect(result.group.membership).toEqual({ id: 7, role: 'admin' })
    expect(result.group.minAmountCents).toBe(25)
  })

  it('parses the minimal non-member preview', () => {
    const result = groupShowFromJSON({
      name: 'Trash Pandas',
      subdomain: 'trash-pandas',
      member_count: 4,
      join_requested: false,
    })

    expect(result.member).toBe(false)
    if (result.member) return
    expect(result.preview).toEqual({
      name: 'Trash Pandas',
      subdomain: 'trash-pandas',
      memberCount: 4,
      joinRequested: false,
    })
  })
})
