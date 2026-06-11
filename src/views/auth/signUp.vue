<script setup lang="ts">
import { computed, reactive, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Message from 'primevue/message'
import config from '@/config'
import FormField from '@/components/formField.vue'
import Turnstile from '@/components/turnstile.vue'
import useFormErrorHandling from '@/composables/useFormErrorHandling'
import { useAccountStore } from '@/stores/modules/account'
import { global } from '@/i18n'
import type { SupportedLocale } from '@/i18n/locales'
import AuthCard from '@/components/authCard.vue'
import OauthButtons from '@/components/oauthButtons.vue'

const { t } = useI18n()
const accountStore = useAccountStore()

const user = reactive({
  name: '',
  login: '',
  password: '',
})
const turnstileToken = ref('')
const turnstileRef = useTemplateRef<{ reset: () => void }>('turnstileRef')

const URL = `${config.APIURL}/signup`
const signedUpEmail = ref<string | null>(null)
const { submitHandler, errors, error, isProcessing } = useFormErrorHandling(
  () =>
    accountStore.signUp({
      ...user,
      locale: global.locale.value as SupportedLocale,
      turnstile_token: turnstileToken.value,
    }),
  () => {
    signedUpEmail.value = user.login
  },
  () => {
    turnstileRef.value?.reset()
    turnstileToken.value = ''
  },
)

const errorMessage = computed<string | null>(() =>
  error.value === null ? null : t('auth.signUp.error', { error: error.value }),
)
</script>

<template>
  <main id="main-content" class="auth-view">
    <auth-card>
      <h1>{{ t('auth.signUp.title') }}</h1>

      <template v-if="signedUpEmail">
        <Message severity="success" class="inline-message" data-testid="signup-success">
          {{ t('auth.signUp.checkEmail', { email: signedUpEmail }) }}
        </Message>
        <p>
          <router-link :to="{ name: 'logIn' }">
            {{ t('auth.signUp.logInLink') }}
          </router-link>
        </p>
      </template>

      <template v-else>
        <Message v-if="error" severity="error" class="inline-message">
          {{ errorMessage }}
        </Message>

        <form method="post" :action="URL" @submit.prevent="submitHandler">
          <form-field
            v-model="user.name"
            type="text"
            object="user"
            field="name"
            :errors="errors"
            :label="t('user.name')"
            required
            autocomplete="name"
            data-testid="signup-name"
          />

          <form-field
            v-model="user.login"
            type="email"
            object="user"
            field="login"
            :errors="errors"
            :label="t('user.email')"
            required
            autocomplete="email"
            data-testid="signup-email"
          />

          <form-field
            v-model="user.password"
            type="password"
            object="user"
            field="password"
            :errors="errors"
            :label="t('user.password')"
            required
            autocomplete="new-password"
            data-testid="signup-password"
          />

          <Turnstile
            ref="turnstileRef"
            v-model="turnstileToken"
            :site-key="config.TURNSTILE_SITE_KEY"
            data-testid="signup-turnstile"
          />

          <div class="actions">
            <Button
              type="submit"
              :label="t('auth.signUp.button')"
              :disabled="!turnstileToken || isProcessing"
              data-testid="signup-submit"
            />
          </div>
        </form>

        <oauth-buttons />

        <p>
          <router-link :to="{ name: 'logIn' }">
            {{ t('auth.signUp.logInLink') }}
          </router-link>
        </p>
      </template>
    </auth-card>
  </main>
</template>
