import { onScopeDispose, watch } from 'vue'
import { useAuthStore } from '@/stores/modules/auth'
import { refreshSession } from '@/stores/modules/root'

// Refresh this far ahead of the 15-minute access token's expiry so a fresh
// token is always in hand. This matters most for the WebSocket consumer, which
// is re-minted only when the JWT changes and whose rejected connections are
// terminal: without a proactive refresh, an idle page's live updates silently
// die when the token lapses and never recover until a reload.
const REFRESH_LEAD_MS = 60_000

/**
 * Keeps the session ahead of access-token expiry by scheduling a refresh shortly
 * before it lapses, re-arming on every token change (including the rotation a
 * refresh produces) and standing down once logged out. The refresh itself is
 * cross-tab-coordinated (see {@link refreshSession}), so every open tab
 * converging on the same expiry spends the shared refresh token only once.
 */
export default function useSessionRefresh(): void {
  const auth = useAuthStore()
  let timer: ReturnType<typeof setTimeout> | null = null

  const clear = (): void => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const schedule = (): void => {
    clear()
    const expiresAt = auth.JWTExpiresAt
    if (expiresAt === null || auth.refreshToken === null) return
    const delay = Math.max(expiresAt.getTime() - Date.now() - REFRESH_LEAD_MS, 0)
    timer = setTimeout(() => void refreshSession(), delay)
  }

  // Re-evaluate whenever the token changes: a refresh swaps in a later expiry,
  // and a logout clears it (stopping the schedule).
  watch(() => auth.JWT, schedule, { immediate: true })
  onScopeDispose(clear)
}
