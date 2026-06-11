import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/modules/auth'

/** Redirects to the login view when the visitor is (or becomes) logged out. */
export default function requireAuth() {
  onMounted(async () => {
    const authStore = useAuthStore()
    const router = useRouter()

    if (!authStore.loggedIn) await router.push({ name: 'logIn' })

    watch(
      () => authStore.loggedIn,
      async (isLoggedIn) => {
        if (!isLoggedIn) await router.push({ name: 'logIn' })
      },
    )
  })
}
