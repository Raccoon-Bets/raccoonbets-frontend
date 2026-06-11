import { onMounted, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import requireAuth from '@/composables/requireAuth'
import { useAuthStore } from '@/stores/modules/auth'
import { useGroupStore } from '@/stores/modules/group'

/**
 * Guards a members-only group view: redirects logged-out visitors to login, boots the group from
 * the subdomain's slug, and routes unknown slugs to the missing-group view and authenticated
 * non-members to the join view. Member-only data loads should watch `groupStore.isMember`.
 */
export default function useGroupGuard(): void {
  requireAuth()
  const authStore = useAuthStore()
  const groupStore = useGroupStore()
  const router = useRouter()

  onMounted(() => {
    watchEffect(() => {
      if (!authStore.loggedIn) return // requireAuth handles the redirect
      if (groupStore.groupNotFound) {
        void router.replace({ name: 'groupMissing' })
        return
      }
      if (groupStore.groupPreview !== null) {
        void router.replace({ name: 'join' })
        return
      }
      void groupStore.ensureLoaded()
    })
  })
}
