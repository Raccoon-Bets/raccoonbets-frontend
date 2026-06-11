import { describe, it, expect } from 'vitest'
import { urlBase64ToUint8Array } from '@/utils/webPush'

describe('urlBase64ToUint8Array', () => {
  it('decodes a urlsafe base64 VAPID key to bytes', () => {
    const bytes = urlBase64ToUint8Array('aGVsbG8') // "hello"
    expect(Array.from(bytes)).toEqual([104, 101, 108, 108, 111])
  })
})
