<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  WebAuthnAbortService,
} from '@simplewebauthn/browser'
import Button from 'primevue/button'
import Message from 'primevue/message'
import config from '@/config'
import FormField from '@/components/formField.vue'
import Turnstile from '@/components/turnstile.vue'
import useFormErrorHandling from '@/composables/useFormErrorHandling'
import { errorToString } from '@/utils/errors'
import { afterAuthRoute } from '@/utils/returnTo'
import { useAuthStore } from '@/stores/modules/auth'
import { usePasskeysStore } from '@/stores/modules/passkeys'
import AuthCard from '@/components/authCard.vue'
import OauthButtons from '@/components/oauthButtons.vue'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const passkeysStore = usePasskeysStore()

const session = reactive({
  login: '',
  password: '',
})
const turnstileToken = ref('')
const turnstileRef = useTemplateRef<{ reset: () => void }>('turnstileRef')

const URL = `${config.APIURL}/login`
const { submitHandler, errors, error, isProcessing } = useFormErrorHandling<unknown>(
  () => authStore.logIn({ ...session, turnstile_token: turnstileToken.value }),
  async () => {
    await router.push(afterAuthRoute())
  },
  () => {
    session.password = ''
    turnstileRef.value?.reset()
    turnstileToken.value = ''
  },
)
const errorMessage = computed<string | null>(() =>
  error.value === null ? null : t('auth.logIn.error', { error: error.value }),
)

const passkeysSupported = browserSupportsWebAuthn()
const passkeyError = ref<string | null>(null)

async function logInWithPasskey(): Promise<void> {
  passkeyError.value = null
  try {
    // The explicit button replaces any pending autofill ceremony with the
    // modal picker; startAuthentication aborts the conditional UI itself.
    const result = await passkeysStore.logIn({ useBrowserAutofill: false })
    if (result.ok) await router.push(afterAuthRoute())
    else passkeyError.value = Object.values(result.val).flat().join(', ')
  } catch (err) {
    // A dismissed picker rejects too; that's not worth surfacing loudly,
    // but a real failure message helps debug passkey issues.
    passkeyError.value = errorToString(err)
  }
}

onMounted(async () => {
  if (!(await browserSupportsWebAuthnAutofill())) return
  try {
    const result = await passkeysStore.logIn({ useBrowserAutofill: true })
    if (result.ok) await router.push(afterAuthRoute())
  } catch {
    // Autofill rejects when the user dismisses it, navigates away, or
    // submits the password form. None of these are errors worth surfacing.
  }
})

onBeforeUnmount(() => {
  WebAuthnAbortService.cancelCeremony()
})
</script>

<template>
  <main id="main-content" class="auth-view">
    <auth-card>
      <h1>{{ t('auth.logIn.title') }}</h1>

      <Message v-if="error" severity="error" class="inline-message" data-testid="login-error">
        {{ errorMessage }}
      </Message>

      <form method="post" :action="URL" @submit.prevent="submitHandler">
        <form-field
          v-model="session.login"
          type="email"
          object="session"
          field="login"
          :label="t('user.email')"
          :errors="errors"
          required
          autocomplete="email webauthn"
          data-testid="login-email"
        />

        <form-field
          v-model="session.password"
          type="password"
          object="session"
          field="password"
          :label="t('session.password')"
          :errors="errors"
          required
          autocomplete="current-password"
          data-testid="login-password"
        />

        <Turnstile
          ref="turnstileRef"
          v-model="turnstileToken"
          :site-key="config.TURNSTILE_SITE_KEY"
          data-testid="login-turnstile"
        />

        <div class="actions">
          <Button
            type="submit"
            :label="t('auth.logIn.button')"
            :disabled="!turnstileToken || isProcessing"
            data-testid="login-submit"
          />
          <Button
            v-if="passkeysSupported"
            type="button"
            severity="secondary"
            outlined
            :label="t('auth.logIn.passkeyButton')"
            data-testid="login-passkey"
            @click="logInWithPasskey"
          />
        </div>
      </form>

      <Message
        v-if="passkeyError"
        severity="error"
        class="inline-message"
        data-testid="login-passkey-error"
      >
        {{ passkeyError }}
      </Message>

      <oauth-buttons />

      <p data-testid="forgot-password-link">
        <router-link :to="{ name: 'forgotPassword' }">
          {{ t('auth.logIn.forgotPassword') }}
        </router-link>
      </p>
      <p>
        <router-link :to="{ name: 'signUp' }">
          {{ t('auth.logIn.signUpLink') }}
        </router-link>
      </p>
    </auth-card>
  </main>
</template>
