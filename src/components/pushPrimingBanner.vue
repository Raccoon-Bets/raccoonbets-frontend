<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import { storeToRefs } from 'pinia'
import { useAccountStore } from '@/stores/modules/account'
import { useAuthStore } from '@/stores/modules/auth'
import { ensurePushSubscription, pushSupported } from '@/composables/usePushNotifications'
import { notifySentry } from '@/utils/errors'

const { t } = useI18n()
const accountStore = useAccountStore()
const authStore = useAuthStore()
const { loggedIn } = storeToRefs(authStore)
const { currentUser } = storeToRefs(accountStore)

// Hidden for the rest of this session once the user acts on it. Permission state
// isn't reactive, so we flip this locally rather than re-reading Notification.
const acted = ref(false)

const visible = computed(() => {
  if (acted.value) return false
  if (!loggedIn.value) return false
  const user = currentUser.value
  // No user yet (account still loading): stay hidden until it loads.
  if (!user) return false
  // Already dismissed for this account.
  if (user.pushPromptDismissedAt !== null) return false
  // Nothing to offer if the server has no VAPID key to subscribe against.
  if (!user.vapidPublicKey) return false
  if (!pushSupported() || Notification.permission !== 'default') return false
  return true
})

async function enable(): Promise<void> {
  acted.value = true
  const key = currentUser.value?.vapidPublicKey
  if (key) await ensurePushSubscription(key).catch(notifySentry)
}

async function dismiss(): Promise<void> {
  acted.value = true
  await accountStore.dismissPushPrompt().catch(notifySentry)
}
</script>

<template>
  <div v-if="visible" data-testid="push-priming-banner" class="push-priming-banner">
    <div class="push-priming-banner__text">
      <strong>{{ t('pushBanner.title') }}</strong>
      <p>{{ t('pushBanner.body') }}</p>
    </div>
    <div class="push-priming-banner__actions">
      <Button
        text
        :label="t('pushBanner.dismiss')"
        data-testid="push-priming-dismiss"
        @click="dismiss"
      />
      <Button :label="t('pushBanner.enable')" data-testid="push-priming-enable" @click="enable" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.push-priming-banner {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  background: var(--p-content-background);
  border-bottom: 1px solid var(--p-content-border-color);

  &__text p {
    margin: 0;
  }

  &__actions {
    display: flex;
    gap: var(--spacing-sm);
  }
}
</style>
