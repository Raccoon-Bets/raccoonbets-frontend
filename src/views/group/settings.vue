<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Message from 'primevue/message'
import config from '@/config'
import FormField from '@/components/formField.vue'
import GroupShell from '@/components/group/groupShell.vue'
import MoneyField from '@/components/moneyField.vue'
import StickerCard from '@/components/sticker/stickerCard.vue'
import useFormErrorHandling from '@/composables/useFormErrorHandling'
import useGroupGuard from '@/composables/useGroupGuard'
import { useGroupStore } from '@/stores/modules/group'
import { groupPath } from '@/stores/modules/root'
import { fromMinorUnits, toMinorUnits } from '@/utils/currency'

const { t } = useI18n()
const groupStore = useGroupStore()
useGroupGuard()

const isAdmin = computed(() => groupStore.membership?.role === 'admin')
const currency = computed(() => groupStore.group?.currency ?? 'USD')

// Amount limits are edited as decimal major units and converted to integer
// minor units on submit, like the group creation form.
const form = reactive({
  name: '',
  minAmount: null as number | null,
  maxAmount: null as number | null,
})

watch(
  () => groupStore.group,
  (group) => {
    if (group === null) return
    form.name = group.name
    form.minAmount = fromMinorUnits(group.minAmountCents, group.currency)
    form.maxAmount = fromMinorUnits(group.maxAmountCents, group.currency)
  },
  { immediate: true },
)

const success = ref(false)
const { submitHandler, errors, error, isProcessing } = useFormErrorHandling(
  () => {
    success.value = false
    return groupStore.updateSettings({
      name: form.name,
      min_amount_cents: toMinorUnits(form.minAmount ?? 0, currency.value),
      max_amount_cents: toMinorUnits(form.maxAmount ?? 0, currency.value),
    })
  },
  () => {
    success.value = true
  },
  () => {
    success.value = false
  },
)

const URL = config.APIURL + groupPath('')
</script>

<template>
  <main id="main-content" class="group-view">
    <group-shell>
      <h2>{{ t('settings.title') }}</h2>

      <p v-if="groupStore.groupLoading">{{ t('messages.loading') }}</p>
      <Message v-if="groupStore.groupError" severity="error" class="inline-message">
        {{ t('group.loadError', { error: groupStore.groupError.message }) }}
      </Message>

      <p v-if="groupStore.isMember && !isAdmin" data-testid="settings-not-admin">
        {{ t('settings.notAdmin') }}
      </p>

      <sticker-card v-if="isAdmin && groupStore.group !== null" class="detail-section">
        <Message v-if="error" severity="error" class="inline-message" data-testid="settings-error">
          {{ t('settings.error', { error }) }}
        </Message>
        <Message
          v-if="success"
          severity="success"
          class="inline-message"
          data-testid="settings-success"
        >
          {{ t('settings.success') }}
        </Message>

        <form method="patch" :action="URL" @submit.prevent="submitHandler">
          <form-field
            v-model="form.name"
            type="text"
            object="group"
            field="name"
            :errors="errors"
            :label="t('settings.name')"
            required
            data-testid="settings-name"
          />

          <money-field
            v-model="form.minAmount"
            :currency="currency"
            input-id="group-min_amount_cents"
            field="min_amount_cents"
            :label="t('settings.minAmount')"
            :errors="errors"
            testid="settings-min-amount"
          />

          <money-field
            v-model="form.maxAmount"
            :currency="currency"
            input-id="group-max_amount_cents"
            field="max_amount_cents"
            :label="t('settings.maxAmount')"
            :errors="errors"
            testid="settings-max-amount"
          />

          <div class="actions">
            <Button
              type="submit"
              :label="t('settings.button')"
              :disabled="isProcessing"
              data-testid="settings-submit"
            />
          </div>
        </form>
      </sticker-card>
    </group-shell>
  </main>
</template>
