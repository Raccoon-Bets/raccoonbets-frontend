import { describe, it, expect } from 'vitest'
import { userFromJSON } from '@/stores/coding'

describe('userFromJSON notification preferences', () => {
  it('parses notification_preferences and the vapid key', () => {
    const user = userFromJSON({
      name: 'Rocky',
      notification_preferences: { market_resolved: { email: true, push: false } },
      vapid_public_key: 'BKey',
    })
    expect(user.notificationPreferences.market_resolved).toEqual({ email: true, push: false })
    expect(user.vapidPublicKey).toBe('BKey')
  })

  it('defaults to an empty map when absent', () => {
    const user = userFromJSON({ name: 'Rocky' })
    expect(user.notificationPreferences).toEqual({})
    expect(user.vapidPublicKey).toBeNull()
  })
})
