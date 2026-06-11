<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { Err, Ok } from 'ts-results'
import Button from 'primevue/button'
import Message from 'primevue/message'
import config from '@/config'
import FormField from '@/components/formField.vue'
import useFormErrorHandling from '@/composables/useFormErrorHandling'
import { useAccountStore } from '@/stores/modules/account'
import AuthCard from '@/components/authCard.vue'

const { t } = useI18n()
const route = useRoute()
const accountStore = useAccountStore()

// Backend emails link with `?key=`, but the route also accepts the key as a path segment.
function resetPasswordToken(): string {
  const param = route.params.key
  if (typeof param === 'string' && param) return param
  if (Array.isArray(route.query.key)) return route.query.key[0] ?? ''
  return route.query.key ?? ''
}

const form = reactive({
  password: '',
  confirmation: '',
})
const URL = `${config.APIURL}/reset-password`
const success = ref(false)
const { submitHandler, errors, error, isProcessing } = useFormErrorHandling(
  async () => {
    success.value = false
    if (form.password !== form.confirmation) {
      return new Err({
        password_confirmation: [t('auth.resetPassword.mismatch')],
      })
    }
    return accountStore
      .resetPassword({
        password: form.password,
        token: resetPasswordToken(),
      })
      .then((r) => (r.ok ? Ok.EMPTY : r))
  },
  () => {
    success.value = true
  },
)
</script>

<template>
  <main id="main-content" class="auth-view">
    <auth-card>
      <h1>{{ t('auth.resetPassword.title') }}</h1>

      <form method="post" :action="URL" @submit.prevent="submitHandler">
        <form-field
          v-model="form.password"
          type="password"
          object="user"
          field="password"
          :label="t('user.password')"
          :errors="errors"
          required
          autocomplete="new-password"
          data-testid="reset-password-password"
        />

        <form-field
          v-model="form.confirmation"
          type="password"
          object="user"
          field="password_confirmation"
          :label="t('user.passwordConfirmation')"
          :errors="errors"
          required
          autocomplete="new-password"
          data-testid="reset-password-password-confirmation"
        />

        <div class="actions">
          <Button
            type="submit"
            :label="t('auth.resetPassword.button')"
            :disabled="isProcessing"
            data-testid="reset-password-submit"
          />
        </div>
      </form>

      <Message v-if="error" severity="error" class="inline-message">
        {{ error }}
      </Message>
      <Message
        v-if="errors.key?.length"
        severity="error"
        class="inline-message"
        data-testid="reset-password-errors"
      >
        <ul>
          <li v-for="err in errors.key" :key="err">
            {{ t('auth.resetPassword.tokenError', { error: err }) }}
          </li>
        </ul>
      </Message>

      <template v-if="success">
        <Message severity="success" class="inline-message" data-testid="reset-password-success">
          {{ t('auth.resetPassword.success') }}
        </Message>
        <p>
          <router-link :to="{ name: 'logIn' }">
            {{ t('auth.resetPassword.logInLink') }}
          </router-link>
        </p>
      </template>
    </auth-card>
  </main>
</template>
