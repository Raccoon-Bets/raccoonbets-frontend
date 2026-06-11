import { ref, watch, type Ref } from 'vue'

/** The live availability of a candidate group subdomain. */
export type SubdomainAvailability =
  | 'idle'
  | 'invalid'
  | 'reserved'
  | 'checking'
  | 'available'
  | 'taken'
  | 'error'

// DNS-label format; mirrors the backend's Group::SUBDOMAIN_FORMAT.
const SUBDOMAIN_FORMAT = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

// Mirrors the backend's Group::RESERVED_SUBDOMAINS so reserved names get a
// specific message without a server round-trip. The server still has the
// final word at creation time.
const RESERVED_SUBDOMAINS = new Set([
  'admin',
  'api',
  'app',
  'assets',
  'blog',
  'cable',
  'cdn',
  'cypress',
  'demo',
  'dev',
  'docs',
  'ftp',
  'help',
  'imap',
  'legal',
  'mail',
  'news',
  'pop',
  'raccoonbets',
  'smtp',
  'staging',
  'static',
  'status',
  'support',
  'test',
  'web',
  'www',
  'ws',
])

const DEFAULT_DEBOUNCE_MS = 300

/**
 * Tracks the live availability of a subdomain as the user types. Format and reserved-name
 * problems are reported immediately from local rules; otherwise the (debounced) `check` call
 * decides between `available` and `taken`. Responses superseded by further typing are discarded.
 *
 * @param subdomain The candidate subdomain as typed (trimmed and lowercased before checking).
 * @param check Resolves whether a normalized subdomain is available (e.g. the groups store's
 * `checkAvailability`).
 * @param debounceMs How long to wait after the last keystroke before calling `check`.
 * @returns The reactive availability status.
 */
export default function useSubdomainAvailability(
  subdomain: Ref<string>,
  check: (subdomain: string) => Promise<boolean>,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
): Ref<SubdomainAvailability> {
  const status = ref<SubdomainAvailability>('idle')

  let timer: ReturnType<typeof setTimeout> | null = null
  let sequence = 0

  watch(subdomain, (raw) => {
    if (timer !== null) clearTimeout(timer)
    sequence += 1

    const value = raw.trim().toLowerCase()
    if (value === '') {
      status.value = 'idle'
      return
    }
    if (!SUBDOMAIN_FORMAT.test(value)) {
      status.value = 'invalid'
      return
    }
    if (RESERVED_SUBDOMAINS.has(value)) {
      status.value = 'reserved'
      return
    }

    status.value = 'checking'
    const current = sequence
    timer = setTimeout(() => {
      check(value)
        .then((available) => {
          if (current !== sequence) return
          status.value = available ? 'available' : 'taken'
        })
        .catch(() => {
          if (current !== sequence) return
          status.value = 'error'
        })
    }, debounceMs)
  })

  return status
}
