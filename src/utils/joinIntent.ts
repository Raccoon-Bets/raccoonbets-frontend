// Written when an email/password signup starts from a group subdomain;
// consumed by the join view on the first authenticated visit back.
// localStorage is per-origin — naturally scoped to this group — and
// survives the email-verification round trip (the verification link returns
// to the same subdomain).
const JOIN_INTENT_KEY = 'rb_join_intent'

/** Records that the visitor signed up from this group's subdomain. */
export function rememberJoinIntent(): void {
  localStorage.setItem(JOIN_INTENT_KEY, '1')
}

/**
 * Takes (and clears) the join intent.
 *
 * @returns Whether signup started on this group's subdomain.
 */
export function consumeJoinIntent(): boolean {
  const present = localStorage.getItem(JOIN_INTENT_KEY) !== null
  localStorage.removeItem(JOIN_INTENT_KEY)
  return present
}

/** Clears a join intent that no longer applies (e.g. the visitor is already a member). */
export function clearJoinIntent(): void {
  localStorage.removeItem(JOIN_INTENT_KEY)
}
