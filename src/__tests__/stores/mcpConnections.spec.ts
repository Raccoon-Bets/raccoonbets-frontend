import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMcpConnectionsStore } from '@/stores/modules/mcpConnections'
import { useAuthStore } from '@/stores/modules/auth'
import { JWT } from '../util'

describe('MCP connections store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().$patch({ JWT })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    ['an empty body', new Response(null, { status: 404 }), 'expired or was already used'],
    ['a non-JSON body', new Response('<h1>Not Found</h1>', { status: 404 }), 'expired'],
    [
      'an error code',
      new Response(JSON.stringify({ error: 'mcp_disabled' }), { status: 404 }),
      'turned off',
    ],
  ])(
    'explains a rejected consent request with %s and offers a next step',
    async (_, response, message) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
      const failure = useMcpConnectionsStore().loadConsent('pending')
      await expect(failure).rejects.toThrow(message)
      await expect(failure).rejects.toThrow('from your assistant')
    },
  )
})
