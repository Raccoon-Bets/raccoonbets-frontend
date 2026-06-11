<script setup lang="ts">
import { reactive, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Message from 'primevue/message'
import config from '@/config'
import FormField from '@/components/formField.vue'
import Turnstile from '@/components/turnstile.vue'
import { errorToString } from '@/utils/errors'
import { useAccountStore } from '@/stores/modules/account'
import AuthCard from '@/components/authCard.vue'

const { t } = useI18n()
const accountStore = useAccountStore()

const form = reactive({
  email: '',
})
const turnstileToken = ref('')
const turnstileRef = useTemplateRef<{ reset: () => void }>('turnstileRef')

const URL = `${config.APIURL}/password-resets`
const success = ref(false)
const error = ref<string | null>(null)
const isProcessing = ref(false)

async function submitHandler() {
  isProcessing.value = true
  success.value = false
  error.value = null

  try {
    await accountStore.forgotPassword({
      login: form.email,
      turnstile_token: turnstileToken.value,
    })
    success.value = true
  } catch (err) {
    error.value = errorToString(err)
    turnstileRef.value?.reset()
    turnstileToken.value = ''
  }
  isProcessing.value = false
}
</script>

<template>
  <main id="main-content" class="auth-view">
    <auth-card>
      <h1>{{ t('auth.forgotPassword.title') }}</h1>
      <p>{{ t('auth.forgotPassword.description') }}</p>

      <form method="post" :action="URL" @submit.prevent="submitHandler">
        <form-field
          v-model="form.email"
          type="email"
          object="form"
          field="email"
          :label="t('user.email')"
          required
          autocomplete="email"
          data-testid="forgot-password-email"
        />

        <Turnstile
          ref="turnstileRef"
          v-model="turnstileToken"
          :site-key="config.TURNSTILE_SITE_KEY"
          data-testid="forgot-password-turnstile"
        />

        <div class="actions">
          <Button
            type="submit"
            :label="t('auth.forgotPassword.button')"
            :disabled="!turnstileToken || isProcessing"
            data-testid="forgot-password-submit"
          />
        </div>

        <Message
          v-if="success"
          severity="success"
          class="inline-message"
          data-testid="forgot-password-success"
        >
          {{ t('auth.forgotPassword.success', { email: form.email }) }}
        </Message>
        <Message v-if="error" severity="error" class="inline-message">
          {{ error }}
        </Message>
      </form>

      <p>
        <router-link :to="{ name: 'logIn' }">
          {{ t('auth.forgotPassword.cancelButton') }}
        </router-link>
      </p>
    </auth-card>
  </main>
</template>
