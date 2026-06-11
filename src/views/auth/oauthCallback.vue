<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Message from 'primevue/message'
import { isApex } from '@/config/tenant'
import { notifySentry } from '@/utils/errors'
import { useAuthStore } from '@/stores/modules/auth'
import { useAccountStore } from '@/stores/modules/account'
import AuthCard from '@/components/authCard.vue'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const accountStore = useAccountStore()

const failed = ref(false)

onMounted(async () => {
  // The backend hands the freshly minted tokens (or an error) to the SPA in the
  // URL fragment, so they never reach the server, its logs, or the Referer
  // header. Read them, then immediately strip them from the address bar.
  const fragment = new URLSearchParams(window.location.hash.slice(1))
  history.replaceState(null, '', window.location.pathname)

  const accessToken = fragment.get('access_token')
  const refreshToken = fragment.get('refresh_token')
  if (!accessToken || !refreshToken) {
    failed.value = true
    return
  }

  authStore.setOAuthTokens(accessToken, refreshToken)
  // Unlike password login, the OAuth redirect carries no user profile, so load
  // it before entering the app.
  await accountStore.loadAccount()
  await router.push({ name: isApex ? 'groups' : 'feed' }).catch(notifySentry)
})
</script>

<template>
  <main id="main-content" class="auth-view">
    <auth-card>
      <h1>{{ t('auth.logIn.title') }}</h1>

      <template v-if="failed">
        <Message severity="error" class="inline-message" data-testid="oauth-error">
          {{ t('auth.oauth.error') }}
        </Message>
        <p>
          <router-link :to="{ name: 'logIn' }">
            {{ t('auth.signUp.logInLink') }}
          </router-link>
        </p>
      </template>

      <p v-else data-testid="oauth-pending">
        {{ t('auth.oauth.pending') }}
      </p>
    </auth-card>
  </main>
</template>
