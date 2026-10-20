import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { decideConsent, loadConnections } from '@/services/mcp'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('@/stores/modules/root', () => ({ request }))

describe('MCP connection API', () => {
  afterEach(() => vi.resetAllMocks())

  it('submits only the selected groups and chosen access level', async () => {
    setActivePinia(createPinia())
    request.mockResolvedValue(
      new Response(JSON.stringify({ redirect_uri: 'https://assistant.example/callback?code=abc' })),
    )
    const redirect = await decideConsent('request-id', [3], false)
    expect(request).toHaveBeenCalledWith({
      method: 'post',
      path: '/oauth/requests/request-id/decision',
      body: { approve: true, group_ids: [3], write: false },
    })
    expect(redirect).toBe('https://assistant.example/callback?code=abc')
  })

  it('reports an expired consent or connection request as a usable error', async () => {
    request.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Request expired' }), { status: 404 }),
    )
    await expect(loadConnections()).rejects.toThrow('Request expired')
  })
})
