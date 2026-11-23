interface Env {
  API_ORIGIN: string
  ASSETS: Fetcher
}

const APEX_HOST = 'raccoonbets.org'

const CLIENT_FORWARDING_HEADERS = [
  'host',
  'forwarded',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
]

/**
 * Builds the upstream headers: the client's own, minus any forwarding headers
 * it could have forged, plus trusted ones naming the apex and the visitor's IP
 * as seen by Cloudflare.
 */
function forwardingHeaders(request: Request): Headers {
  const headers = new Headers(request.headers)
  for (const name of CLIENT_FORWARDING_HEADERS) headers.delete(name)
  headers.set('X-Forwarded-Host', APEX_HOST)
  headers.set('X-Forwarded-Proto', 'https')
  const clientIp = request.headers.get('CF-Connecting-IP')
  if (clientIp) {
    headers.set('X-Forwarded-For', clientIp)
    headers.set('X-Real-IP', clientIp)
  }
  return headers
}

/**
 * Forwards an OAuth request to the backend. The browser only ever talks to the
 * apex, so the OmniAuth `state` cookie stays first-party; the backend builds
 * its callback URL from `X-Forwarded-Host`, which is always the apex.
 * Redirects and `Set-Cookie` headers pass through untouched.
 */
function proxyToApi(request: Request, env: Env): Promise<Response> {
  const incoming = new URL(request.url)
  const target = new URL(incoming.pathname + incoming.search, env.API_ORIGIN)
  const headers = forwardingHeaders(request)

  return fetch(target, {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual',
  })
}

function isSpaFallback(pathname: string, response: Response): boolean {
  return (
    !pathname.endsWith('.html') && !!response.headers.get('Content-Type')?.startsWith('text/html')
  )
}

/**
 * Serves a dotted path (`/favicon.ico`, `/sw.js`, probes like `/.env`) from the
 * assets. The asset layer answers a missing file with the SPA shell, which is
 * turned into a 404 here so such requests never look like pages.
 */
async function serveFile(request: Request, env: Env): Promise<Response> {
  const response = await env.ASSETS.fetch(request)
  return isSpaFallback(new URL(request.url).pathname, response) ? notFound() : response
}

function notFound(): Response {
  return new Response('Not Found', {
    status: 404,
    headers: { 'Cache-Control': 'no-cache, no-transform' },
  })
}

export default {
  fetch(request, env) {
    if (new URL(request.url).pathname.startsWith('/auth/')) return proxyToApi(request, env)
    return serveFile(request, env)
  },
} satisfies ExportedHandler<Env>
