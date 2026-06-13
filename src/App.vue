<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAccountStore } from '@/stores/modules/account'
import { useAuthStore } from '@/stores/modules/auth'
import { refreshSession } from '@/stores/modules/root'
import { usePushNotifications } from '@/composables/usePushNotifications'
import useSessionRefresh from '@/composables/useSessionRefresh'

const { t } = useI18n()
const accountStore = useAccountStore()
const authStore = useAuthStore()

usePushNotifications()
useSessionRefresh()

onMounted(async () => {
  // Tokens live in apex-domain cookies so a login on the apex carries over to
  // every group subdomain (and vice versa); persist every change back.
  authStore.initializeFromCookies()
  authStore.$subscribe(() => {
    authStore.persistToCookies()
  })

  // The access token may have lapsed while the app was closed; revive the
  // session from the refresh token before loading the account, which otherwise
  // no-ops for a (transiently) logged-out user and leaves a returning visitor
  // looking signed out.
  if (!authStore.loggedIn && authStore.refreshToken && authStore.JWT) {
    await refreshSession()
  }

  await accountStore.loadAccount()
})
</script>

<template>
  <a class="skip-link" href="#main-content">{{ t('a11y.skipToContent') }}</a>
  <router-view />
</template>

<style scoped lang="scss">
.skip-link {
  // Visually hidden until keyboard-focused — clipped to a 1px box rather
  // than parked offscreen, so rubber-band overscroll can't reveal it.
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1000;
  width: 1px;
  height: 1px;
  overflow: hidden;
  white-space: nowrap;
  clip-path: inset(50%);

  &:focus {
    width: auto;
    height: auto;
    padding: var(--spacing-sm) var(--spacing-md);
    overflow: visible;
    clip-path: none;
    font-weight: 600;
    color: var(--p-text-color);
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 0 0 var(--p-content-border-radius);
    outline: 2px solid var(--p-primary-color);
    outline-offset: 2px;
  }
}
</style>
