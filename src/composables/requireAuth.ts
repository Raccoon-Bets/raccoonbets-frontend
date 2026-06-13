import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { rememberReturnTo } from '@/utils/returnTo'
import { useAuthStore } from '@/stores/modules/auth'
import { refreshSession } from '@/stores/modules/root'

/**
 * Redirects to the login view when the visitor is (or becomes) logged out.
 * Arriving logged out remembers the intended destination so login can return
 * to it; becoming logged out (an explicit logout) does not, so the next login
 * lands on the default page rather than wherever the user logged out from.
 */
export default function requireAuth() {
  onMounted(async () => {
    const authStore = useAuthStore()
    const route = useRoute()
    const router = useRouter()

    // An expired access token alongside a live refresh token is not a logout —
    // the 15-minute access token has merely lapsed (common after a reload or
    // when a backgrounded mobile tab is restored). Refresh transparently before
    // treating the visit as unauthenticated so a valid 30-day session is never
    // bounced to the login screen.
    if (!authStore.loggedIn && authStore.refreshToken && authStore.JWT) {
      await refreshSession()
    }

    if (!authStore.loggedIn) {
      rememberReturnTo(route.fullPath)
      await router.push({ name: 'logIn' })
    }

    watch(
      () => authStore.loggedIn,
      async (isLoggedIn) => {
        if (!isLoggedIn) await router.push({ name: 'logIn' })
      },
    )
  })
}
