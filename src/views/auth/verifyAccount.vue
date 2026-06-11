<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useTimeoutFn } from '@vueuse/core'
import Message from 'primevue/message'
import { errorToString, notifySentry } from '@/utils/errors'
import { useAccountStore } from '@/stores/modules/account'
import AuthCard from '@/components/authCard.vue'

const REDIRECT_DELAY_MS = 1500

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const accountStore = useAccountStore()

type State = 'pending' | 'success' | 'failure'

const state = ref<State>('pending')
const errorText = ref<string | null>(null)

// Backend emails link with `?key=`, but the route also accepts the key as a path segment.
function verifyAccountKey(): string {
  const param = route.params.key
  if (typeof param === 'string' && param) return param
  if (Array.isArray(route.query.key)) return route.query.key[0] ?? ''
  return route.query.key ?? ''
}

onMounted(async () => {
  try {
    const result = await accountStore.verifyAccount(verifyAccountKey())
    if (result.ok) {
      state.value = 'success'
      useTimeoutFn(
        () => {
          router.push({ name: 'logIn' }).catch(notifySentry)
        },
        REDIRECT_DELAY_MS,
        { immediate: true },
      )
    } else {
      state.value = 'failure'
      errorText.value = Object.values(result.val).flat().join(', ')
    }
  } catch (err) {
    notifySentry(err)
    state.value = 'failure'
    errorText.value = errorToString(err)
  }
})
</script>

<template>
  <main id="main-content" class="auth-view">
    <auth-card>
      <h1>{{ t('auth.verifyAccount.title') }}</h1>

      <p v-if="state === 'pending'" data-testid="verify-account-pending">
        {{ t('auth.verifyAccount.pending') }}
      </p>

      <Message
        v-else-if="state === 'success'"
        severity="success"
        class="inline-message"
        data-testid="verify-account-success"
      >
        {{ t('auth.verifyAccount.success') }}
      </Message>

      <Message v-else severity="error" class="inline-message" data-testid="verify-account-failure">
        {{ t('auth.verifyAccount.failure', { error: errorText }) }}
      </Message>
    </auth-card>
  </main>
</template>
