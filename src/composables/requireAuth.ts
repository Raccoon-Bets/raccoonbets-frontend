import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { rememberReturnTo } from '@/utils/returnTo'
import { useAuthStore } from '@/stores/modules/auth'

/**
 * Redirects to the login view when the visitor is (or becomes) logged out,
 * remembering the intended destination so login can return to it.
 */
export default function requireAuth() {
  onMounted(async () => {
    const authStore = useAuthStore()
    const route = useRoute()
    const router = useRouter()

    const redirectToLogIn = async () => {
      rememberReturnTo(route.fullPath)
      await router.push({ name: 'logIn' })
    }

    if (!authStore.loggedIn) await redirectToLogIn()

    watch(
      () => authStore.loggedIn,
      async (isLoggedIn) => {
        if (!isLoggedIn) await redirectToLogIn()
      },
    )
  })
}
