<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Message from 'primevue/message'
import config from '@/config'
import FormField from '@/components/formField.vue'
import useFormErrorHandling from '@/composables/useFormErrorHandling'
import type { UserJSONUp } from '@/stores/coding'
import { useAccountStore } from '@/stores/modules/account'
import { global } from '@/i18n'
import type { SupportedLocale } from '@/i18n/locales'

const { t } = useI18n()
const accountStore = useAccountStore()

const URL = `${config.APIURL}/account`
const user: UserJSONUp = reactive({
  email: accountStore.currentUser?.email ?? '',
  name: accountStore.currentUser?.name ?? '',
  locale: accountStore.currentUser?.locale ?? (global.locale.value as SupportedLocale),
  venmo_handle: accountStore.currentUser?.venmoHandle ?? null,
  paypal_handle: accountStore.currentUser?.paypalHandle ?? null,
  cashapp_cashtag: accountStore.currentUser?.cashappCashtag ?? null,
})

// v-model needs strings; empty submits as null so the backend clears the handle.
function handleModel(field: 'venmo_handle' | 'paypal_handle' | 'cashapp_cashtag') {
  return computed({
    get: () => user[field] ?? '',
    set: (value: string) => {
      user[field] = value.trim() === '' ? null : value
    },
  })
}
const venmoHandle = handleModel('venmo_handle')
const paypalHandle = handleModel('paypal_handle')
const cashappCashtag = handleModel('cashapp_cashtag')

const success = ref(false)
const { submitHandler, errors, error, isProcessing } = useFormErrorHandling(
  () => {
    success.value = false
    return accountStore.updateAccount({ ...user })
  },
  () => {
    success.value = true
  },
  () => {
    success.value = false
  },
)

const dirty = computed<boolean>(() => {
  const current = accountStore.currentUser
  if (current === null) return true
  return (
    user.email !== current.email ||
    user.name !== current.name ||
    user.venmo_handle !== current.venmoHandle ||
    user.paypal_handle !== current.paypalHandle ||
    user.cashapp_cashtag !== current.cashappCashtag
  )
})

watch(
  () => accountStore.currentUser,
  (current) => {
    if (current === null) return // requireAuth will handle redirect
    user.email = current.email ?? ''
    user.name = current.name
    if (current.locale) user.locale = current.locale
    user.venmo_handle = current.venmoHandle
    user.paypal_handle = current.paypalHandle
    user.cashapp_cashtag = current.cashappCashtag
  },
)
</script>

<template>
  <p v-if="!accountStore.currentUser">
    {{ t('messages.loading') }}
  </p>

  <form
    v-else
    method="patch"
    :action="URL"
    data-testid="account-form"
    @submit.prevent="submitHandler"
  >
    <h2>{{ t('account.profile.title') }}</h2>

    <form-field
      v-model="user.name"
      type="text"
      object="user"
      field="name"
      required
      :errors="errors"
      :label="t('user.name')"
      autocomplete="name"
      data-testid="account-name"
    />

    <form-field
      v-model="user.email"
      type="email"
      object="user"
      field="email"
      required
      :errors="errors"
      :label="t('user.email')"
      autocomplete="email"
      data-testid="account-email"
    />

    <h2>{{ t('account.paymentHandles.title') }}</h2>
    <p>{{ t('account.paymentHandles.description') }}</p>

    <form-field
      v-model="venmoHandle"
      type="text"
      object="user"
      field="venmo_handle"
      :errors="errors"
      :label="t('account.paymentHandles.venmo')"
      data-testid="account-venmo"
    />

    <form-field
      v-model="paypalHandle"
      type="text"
      object="user"
      field="paypal_handle"
      :errors="errors"
      :label="t('account.paymentHandles.paypal')"
      data-testid="account-paypal"
    />

    <form-field
      v-model="cashappCashtag"
      type="text"
      object="user"
      field="cashapp_cashtag"
      :errors="errors"
      :label="t('account.paymentHandles.cashapp')"
      data-testid="account-cashapp"
    />

    <div class="actions">
      <Button
        type="submit"
        :label="t('account.button')"
        :disabled="!dirty || isProcessing"
        data-testid="account-submit"
      />
    </div>
  </form>

  <Message v-if="error" severity="error" class="inline-message" data-testid="account-errors">
    {{ error }}
  </Message>
  <Message v-if="success" severity="success" class="inline-message" data-testid="account-success">
    {{ t('account.success') }}
  </Message>
</template>
