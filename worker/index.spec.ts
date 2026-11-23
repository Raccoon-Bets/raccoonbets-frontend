import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './index'

const env = { API_ORIGIN: 'https://api.example.test', ASSETS: {} as Fetcher }

function callWorker(url: string, init?: RequestInit) {
  return worker.fetch(new Request(url, init) as never, env)
}

describe('worker', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('/auth/*', () => {
    it('forwards the request to the API with forwarding headers and returns the response untouched', async () => {
      const upstream = new Response(null, {
        status: 302,
        headers: {
          Location: 'https://accounts.example.test/',
          'Set-Cookie': '_rb_oauth_session=abc',
        },
      })
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(upstream)
      vi.stubGlobal('fetch', fetchMock)

      const response = await callWorker('https://raccoonbets.org/auth/google/callback?code=1', {
        method: 'POST',
        body: 'payload',
        headers: { 'CF-Connecting-IP': '203.0.113.9', Cookie: 'a=b' },
      })

      expect(response).toBe(upstream)
      const [target, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
      expect(target.href).toBe('https://api.example.test/auth/google/callback?code=1')
      expect(init.method).toBe('POST')
      expect(init.redirect).toBe('manual')
      const headers = init.headers as Headers
      expect(headers.get('X-Forwarded-Host')).toBe('raccoonbets.org')
      expect(headers.get('X-Forwarded-Proto')).toBe('https')
      expect(headers.get('X-Real-IP')).toBe('203.0.113.9')
      expect(headers.get('Cookie')).toBe('a=b')
      expect(headers.has('host')).toBe(false)
    })
  })

  describe('other paths', () => {
    function stubAssets(response: Response) {
      return {
        ...env,
        ASSETS: { fetch: vi.fn().mockResolvedValue(response) } as unknown as Fetcher,
      }
    }

    it('serves an existing file from the assets', async () => {
      const file = new Response('body', { headers: { 'Content-Type': 'text/javascript' } })

      const response = await worker.fetch(
        new Request('https://raccoonbets.org/sw.js') as never,
        stubAssets(file),
      )

      expect(response).toBe(file)
    })

    it('answers an uncached 404 when the assets fall back to the SPA shell', async () => {
      const shell = new Response('<html>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })

      const response = await worker.fetch(
        new Request('https://raccoonbets.org/.env') as never,
        stubAssets(shell),
      )

      expect(response.status).toBe(404)
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform')
    })
  })
})
