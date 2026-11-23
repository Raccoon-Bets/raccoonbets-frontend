interface Env {
  API_ORIGIN: string
  ASSETS: Fetcher
}

/**
 * Forwards an OAuth request to the backend. The browser only ever talks to the
 * apex, so the OmniAuth `state` cookie stays first-party; the backend builds
 * its callback URL from `X-Forwarded-Host`. Redirects and `Set-Cookie` headers
 * pass through untouched.
 */
function proxyToApi(request: Request, env: Env): Promise<Response> {
  const incoming = new URL(request.url)
  const target = new URL(incoming.pathname + incoming.search, env.API_ORIGIN)

  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.set('X-Forwarded-Host', incoming.host)
  headers.set('X-Forwarded-Proto', 'https')
  const clientIp = request.headers.get('CF-Connecting-IP')
  if (clientIp) headers.set('X-Real-IP', clientIp)

  return fetch(target, {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual',
  })
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
    return Promise.resolve(notFound())
  },
} satisfies ExportedHandler<Env>
