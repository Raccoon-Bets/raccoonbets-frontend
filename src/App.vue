<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAccountStore } from '@/stores/modules/account'
import { useAuthStore } from '@/stores/modules/auth'
import { usePushNotifications } from '@/composables/usePushNotifications'

const { t } = useI18n()
const accountStore = useAccountStore()
const authStore = useAuthStore()

usePushNotifications()

onMounted(async () => {
  // Tokens live in apex-domain cookies so a login on the apex carries over to
  // every group subdomain (and vice versa); persist every change back.
  authStore.initializeFromCookies()
  authStore.$subscribe(() => {
    authStore.persistToCookies()
  })

  await accountStore.loadAccount()
})
</script>

<template>
  <a class="skip-link" href="#main-content">{{ t('a11y.skipToContent') }}</a>
  <router-view />
</template>

<style scoped lang="scss">
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  z-index: 1000;
  padding: var(--spacing-sm) var(--spacing-md);
  font-weight: 600;
  color: var(--p-text-color);
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  border-radius: 0 0 var(--p-content-border-radius);
  transition: top 0.15s ease;

  &:focus {
    top: 0;
    outline: 2px solid var(--p-primary-color);
    outline-offset: 2px;
  }
}
</style>
