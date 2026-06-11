import config from '@/config'

/** Attributes applied to a serialized cookie. */
export interface CookieAttributes {
  /** The domain the cookie is scoped to (sent with a leading dot for subdomain sharing). */
  domain: string

  /** Whether to mark the cookie `Secure` (HTTPS-only). */
  secure: boolean

  /** Cookie lifetime in seconds; `0` or negative expires the cookie immediately. */
  maxAge: number
}

// Matches the backend's 30-day refresh-token deadline; the JWT cookie going
// stale alongside it is harmless since the JWT expires far sooner anyway.
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

/**
 * Serializes a `Set-Cookie`-style string for `document.cookie` assignment.
 *
 * The cookie is scoped to the apex domain (so it is shared between the apex and every group
 * subdomain), `Path=/`, and `SameSite=Lax`.
 *
 * @param name The cookie name.
 * @param value The raw value (URI-encoded during serialization).
 * @param attributes Domain/secure/lifetime attributes.
 * @returns The serialized cookie string.
 */
export function serializeCookie(name: string, value: string, attributes: CookieAttributes): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Domain=.${attributes.domain}`,
    'Path=/',
    `Max-Age=${String(attributes.maxAge)}`,
    'SameSite=Lax',
  ]
  if (attributes.secure) parts.push('Secure')
  return parts.join('; ')
}

/**
 * Extracts a cookie's value from a `document.cookie`-style string.
 *
 * @param cookieString The `name=value; other=value` cookie string.
 * @param name The cookie name to look up.
 * @returns The decoded value, or `null` if the cookie is absent.
 */
export function parseCookieValue(cookieString: string, name: string): string | null {
  for (const pair of cookieString.split(';')) {
    const separatorIndex = pair.indexOf('=')
    if (separatorIndex === -1) continue
    if (pair.slice(0, separatorIndex).trim() !== name) continue
    return decodeURIComponent(pair.slice(separatorIndex + 1).trim())
  }
  return null
}

function currentAttributes(maxAge: number): CookieAttributes {
  return {
    domain: config.apexDomain,
    secure: window.location.protocol === 'https:',
    maxAge,
  }
}

/**
 * Reads a cookie.
 *
 * @param name The cookie name.
 * @returns The decoded value, or `null` if the cookie is absent.
 */
export function getCookie(name: string): string | null {
  return parseCookieValue(document.cookie, name)
}

/**
 * Writes a cookie shared across the apex domain and all of its subdomains.
 *
 * @param name The cookie name.
 * @param value The value to store.
 */
export function setCookie(name: string, value: string): void {
  document.cookie = serializeCookie(name, value, currentAttributes(DEFAULT_MAX_AGE_SECONDS))
}

/**
 * Deletes a cookie previously written by {@link setCookie}.
 *
 * @param name The cookie name.
 */
export function removeCookie(name: string): void {
  document.cookie = serializeCookie(name, '', currentAttributes(0))
}
