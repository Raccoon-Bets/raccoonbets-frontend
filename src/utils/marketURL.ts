/**
 * Lowercases, strips diacritics, and reduces a string to URL-safe words joined
 * by single hyphens. Returns an empty string when no alphanumerics remain.
 *
 * @param value The text to slugify (e.g. a market title).
 * @returns A hyphenated ASCII slug, or `''` if no ASCII-range alphanumerics remain after normalization.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Builds the canonical router `:marketId` param for a market: `{id}-{slug}`.
 *
 * The slug suffix is cosmetic — the backend resolves a market by the leading
 * integer id regardless of the suffix — so it need only be readable and
 * self-consistent. Titles with no slug-able characters yield the bare id.
 *
 * @param market The market's id and title.
 * @returns The `:marketId` param, e.g. `42-who-wins-the-super-bowl`.
 */
export function marketPath(market: { id: number; title: string }): string {
  const suffix = slugify(market.title)
  const id = String(market.id)
  return suffix === '' ? id : `${id}-${suffix}`
}
