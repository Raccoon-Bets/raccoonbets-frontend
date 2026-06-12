import type { RouteLocationRaw } from 'vue-router'
import { isApex } from '@/config/tenant'

// Written by requireAuth() before bouncing to login; consumed by the
// post-auth navigation in the login and OAuth-callback views. sessionStorage
// is per-origin and per-tab, which scopes the destination to the subdomain
// (and the visit) that requested it and survives the OAuth round trip.
const RETURN_TO_KEY = 'rb_return_to'

/**
 * Remembers the in-app path to return to once authentication completes.
 *
 * @param fullPath The intended route's full path, including query and hash.
 */
export function rememberReturnTo(fullPath: string): void {
  sessionStorage.setItem(RETURN_TO_KEY, fullPath)
}

function consumeReturnTo(): string | null {
  const path = sessionStorage.getItem(RETURN_TO_KEY)
  sessionStorage.removeItem(RETURN_TO_KEY)
  // Only in-app paths survive: an absolute or protocol-relative value (which
  // could only appear by tampering) must not redirect off-site.
  if (path === null || !path.startsWith('/') || path.startsWith('//')) return null
  return path
}

/**
 * The route to enter after authentication: the remembered destination when
 * one was set, otherwise the app's home (the groups list on the apex, the
 * feed on a group subdomain).
 */
export function afterAuthRoute(): RouteLocationRaw {
  return consumeReturnTo() ?? { name: isApex ? 'groups' : 'feed' }
}
