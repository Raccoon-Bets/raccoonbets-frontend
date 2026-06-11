import config from '@/config'

/**
 * Builds the full URL of a group's app from its subdomain.
 *
 * @param subdomain The group's subdomain slug.
 * @param apexDomain The apex domain the SPA is served from (e.g. `raccoonbets.org`).
 * @param protocol The URL scheme with trailing colon, as in `location.protocol` (e.g. `https:`).
 * @param port The port, as in `location.port` (empty string for the protocol default).
 * @returns The group app's root URL (e.g. `https://trash-pandas.raccoonbets.org/`).
 */
export function buildGroupURL(
  subdomain: string,
  apexDomain: string,
  protocol: string,
  port: string,
): string {
  const portSuffix = port === '' ? '' : `:${port}`
  return `${protocol}//${subdomain}.${apexDomain}${portSuffix}/`
}

/**
 * Builds the full URL of a group's app on the configured apex domain, preserving the current
 * page's scheme and port (so dev ports like `:5173` carry over).
 *
 * @param subdomain The group's subdomain slug.
 * @returns The group app's root URL.
 */
export default function groupURL(subdomain: string): string {
  return buildGroupURL(subdomain, config.apexDomain, window.location.protocol, window.location.port)
}
