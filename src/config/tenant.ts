import config from '@/config'

/** Which app the SPA should present, derived from the hostname it was loaded on. */
export interface Tenant {
  /** Whether this is the apex (marketing/account) app rather than a group app. */
  isApex: boolean

  /** The group's subdomain slug when on a group subdomain, `null` on the apex. */
  groupSlug: string | null
}

// Subdomains that can never be group slugs: infrastructure hosts and the bare
// www alias. Mirrors the backend's RESERVED_SUBDOMAINS list.
const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'ws', 'cable', 'admin'])

const SLUG_PATTERN = /^[a-z0-9-]+$/

/**
 * Determines the tenant for a hostname relative to the configured apex domain.
 *
 * The apex domain itself (and its `www.` alias) is the apex app. A single-label subdomain of the
 * apex domain that isn't reserved is a group app. Everything else — multi-label subdomains,
 * reserved subdomains, and foreign hosts — falls back to the apex app.
 *
 * @param hostname The hostname the SPA was loaded on (no port).
 * @param apexDomain The apex domain the SPA is served from (e.g. `raccoonbets.org`).
 * @returns The resolved tenant.
 */
export function parseTenant(hostname: string, apexDomain: string): Tenant {
  const apex: Tenant = { isApex: true, groupSlug: null }

  const host = hostname.toLowerCase()
  const domain = apexDomain.toLowerCase()

  if (host === domain || host === `www.${domain}`) return apex
  if (!host.endsWith(`.${domain}`)) return apex

  const label = host.slice(0, -(domain.length + 1))
  if (label.includes('.')) return apex
  if (RESERVED_SUBDOMAINS.has(label)) return apex
  if (!SLUG_PATTERN.test(label)) return apex

  return { isApex: false, groupSlug: label }
}

const tenant = parseTenant(window.location.hostname, config.apexDomain)

/** Whether the SPA is serving the apex (marketing/account) app. */
export const isApex = tenant.isApex

/** The current group's subdomain slug, or `null` on the apex. */
export const groupSlug = tenant.groupSlug
