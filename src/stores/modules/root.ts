import { z } from 'zod'
import { Err, Ok } from 'ts-results'
import config from '@/config'
import { groupSlug } from '@/config/tenant'
import type { APIResponse } from '@/stores/types'
import { global } from '@/i18n'
import { useAuthStore } from '@/stores/modules/auth'
import { useAccountStore } from '@/stores/modules/account'

// Rodauth returns errors as either:
//   { error: "message" }
//   { "field-error": ["field_name", "error message"], error: "message" }
// Custom Rails controllers return:
//   { errors: { field: ["error 1"] } }
const apiErrorBodySchema = z.object({
  errors: z.record(z.string(), z.array(z.string())).optional(),
  error: z.string().optional(),
  'field-error': z.tuple([z.string(), z.string()]).optional(),
})

interface RequestArgs {
  method?: string
  path: string
  body?: Record<string, unknown> | FormData | string
  /** Don't log the user out if the response is 401 (for endpoints where 401
   *  is a business-logic outcome, e.g. login, password reset request). */
  skipResetAuth?: boolean
  /** Don't include the Authorization header (for fully public endpoints). */
  unauthenticated?: boolean
  /** Internal: suppress the refresh-and-retry on 401. Set on the refresh
   *  request itself and on the single post-refresh replay so neither can
   *  recurse back into another refresh. */
  skipRefresh?: boolean
}

// Retried on cold-start failures: Fly's proxy returns 504 without CORS
// headers when the backend is slow to wake, which surfaces in the browser
// as a generic network error (fetch rejects, not a readable status). A
// single retry after a short delay is enough to cover typical Fly + Neon
// wake latency.
const RETRY_DELAY_MS = 2000

// Coalesces concurrent token refreshes. When several in-flight requests get a
// 401 at once they all await this single promise, so the refresh token (which
// Rodauth rotates on use) is spent exactly once per expiry.
let inFlightRefresh: Promise<boolean> | null = null

// Returned to callers after an unrecoverable 401: see the comment above its use.
const NEVER_SETTLES = new Promise<Response>(() => undefined)

// Serializes refreshes across every tab and subdomain on the shared apex-cookie
// session via the Web Locks API, so the single-use refresh token is rotated by
// exactly one context per expiry while the rest adopt the rotated token from the
// cookie. Falls back to no cross-tab lock where the API is unavailable (the
// in-tab `inFlightRefresh` and the cookie-adopt recovery still apply).
function withRefreshLock(run: () => Promise<boolean>): Promise<boolean> {
  // The Web Locks API needs a secure context and isn't universally available
  // (older browsers, dev's http origin), so feature-detect it rather than trust
  // the DOM lib's unconditional typing.
  const lockManager = (navigator as { locks?: LockManager }).locks
  return lockManager ? lockManager.request('rb-token-refresh', run) : run()
}

function refreshAccessTokenOnce(auth: ReturnType<typeof useAuthStore>): Promise<boolean> {
  // refreshAccessToken adopts a sibling's rotated token from the cookie before
  // spending its own, so holding the lock around it means a tab that waited
  // simply inherits the winner's session rather than refreshing again.
  inFlightRefresh ??= withRefreshLock(() => auth.refreshAccessToken()).finally(() => {
    inFlightRefresh = null
  })
  return inFlightRefresh
}

/**
 * Refreshes the access token using the stored refresh token, coalescing
 * concurrent callers onto the single in-flight `/jwt-refresh` so Rodauth's
 * single-use refresh token is spent exactly once. Shared by the 401-retry path
 * and the auth gate / bootstrap, which use it to revive an expired-but-
 * refreshable session instead of treating it as logged out.
 *
 * @returns Whether the session is valid after the attempt.
 */
export function refreshSession(): Promise<boolean> {
  return refreshAccessTokenOnce(useAuthStore())
}

/**
 * Prefixes an API path with the current group's scope. The API is path-scoped: group endpoints
 * live under `/groups/:slug/...` where `:slug` is the subdomain slug.
 *
 * @param path The unscoped path (e.g. `/markets`).
 * @returns The group-scoped path (e.g. `/groups/trash-pandas/markets`).
 * @throws When called on the apex, where there is no current group.
 */
export function groupPath(path: string): string {
  if (groupSlug === null) throw new Error('groupPath() requires a group subdomain')
  return `/groups/${groupSlug}${path}`
}

export async function request({
  method,
  path,
  body,
  skipResetAuth,
  unauthenticated,
  skipRefresh,
}: RequestArgs): Promise<Response> {
  const auth = useAuthStore()
  const account = useAccountStore()

  let serializedBody: FormData | string
  if (!(body instanceof FormData) && typeof body !== 'string') {
    serializedBody = JSON.stringify(body)
  } else {
    serializedBody = body
  }

  const url = config.APIURL + path

  // Rebuilt per attempt so a replay after refresh carries the new token.
  const buildInit = (): RequestInit => {
    // `Accept-Language` is a forbidden header for fetch, so the active locale is sent
    // out-of-band; the backend reads it to localize validation errors and flash messages.
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Locale': global.locale.value,
    }
    if (!unauthenticated && auth.authHeader !== null) headers.Authorization = auth.authHeader
    if (!(body instanceof FormData) && typeof body !== 'string') {
      headers['Content-Type'] = 'application/json'
    }
    return {
      method: method ?? 'get',
      body: serializedBody,
      headers,
      credentials: 'include',
    }
  }

  const fetchWithColdStartRetry = async (retriesLeft: number): Promise<Response> => {
    try {
      return await fetch(url, buildInit())
    } catch (error: unknown) {
      if (retriesLeft > 0) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
        return fetchWithColdStartRetry(retriesLeft - 1)
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  const response = await fetchWithColdStartRetry(1)
  if (response.status !== 401 || skipResetAuth) return response

  // Expired but refreshable: get a new token and replay with it.
  if (!skipRefresh && (await refreshAccessTokenOnce(auth))) {
    const replay = await fetchWithColdStartRetry(1)
    if (replay.status !== 401) return replay
  }

  // The session is unrecoverable. Clear it, then — for a request that carried
  // credentials — retry once anonymously so public endpoints still resolve
  // (e.g. an invitation link opened after the session lapsed). The reset
  // reactively logs the user out; buildInit() omits the now-absent token.
  const wasAuthenticated = !unauthenticated && auth.authHeader !== null
  auth.reset()
  account.reset()
  if (wasAuthenticated) {
    const anonymous = await fetchWithColdStartRetry(1)
    if (anonymous.status !== 401) return anonymous
  }

  // Auth-required endpoint with no usable session: leave the promise unsettled
  // so no stale handler runs against the torn-down session.
  return NEVER_SETTLES
}

export async function requestJSON<T>(args: RequestArgs): Promise<APIResponse<T>> {
  const response = await request(args)
  if (response.ok) {
    return new Ok({
      response,
      body: response.status === 204 ? undefined : ((await response.json()) as T),
    })
  }
  const parsed = apiErrorBodySchema.parse(await response.json())
  // Normalize Rodauth's ["field", "message"] tuple into { field: ["message"] }.
  const errors =
    parsed.errors ??
    (parsed['field-error'] ? { [parsed['field-error'][0]]: [parsed['field-error'][1]] } : undefined)
  return new Err({
    response,
    body: { errors, error: parsed.error },
  })
}
