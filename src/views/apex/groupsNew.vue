<script setup lang="ts">
import { computed, reactive, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Select from 'primevue/select'
import config from '@/config'
import FieldErrors from '@/components/fieldErrors.vue'
import FormField from '@/components/formField.vue'
import MoneyField from '@/components/moneyField.vue'
import StickerCard from '@/components/sticker/stickerCard.vue'
import requireAuth from '@/composables/requireAuth'
import useFormErrorHandling from '@/composables/useFormErrorHandling'
import useSubdomainAvailability from '@/composables/useSubdomainAvailability'
import { useGroupsStore } from '@/stores/modules/groups'
import type { GroupJSONUp } from '@/stores/coding'
import { defaultAmountRange, fractionDigits, fromMinorUnits, toMinorUnits } from '@/utils/currency'
import groupURL from '@/utils/groupURL'
import { slugify } from '@/utils/marketURL'

// A modest starter list; the backend accepts any ISO 4217 code the money gem
// knows, so this can grow freely.
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']

const { t, n } = useI18n()
const groupsStore = useGroupsStore()
requireAuth()

const group = reactive({
  name: '',
  subdomain: '',
  currency: 'USD',
  // Amount limits are entered as decimal major units (e.g. 0.25 for 25¢) and
  // converted to integer minor units on submit; blank means backend defaults.
  minAmount: null as number | null,
  maxAmount: null as number | null,
})

const availability = useSubdomainAvailability(toRef(group, 'subdomain'), (subdomain) =>
  groupsStore.checkAvailability(subdomain),
)

// Suggest a subdomain from the group name as the user types. Once they edit the
// subdomain themselves their choice stands — unless they clear it back out, which
// resumes suggestions rather than leaving the required field blank.
const subdomainEdited = ref(false)
watch(
  () => group.name,
  (name) => {
    if (!subdomainEdited.value || group.subdomain.trim() === '') group.subdomain = slugify(name)
  },
)

const previewHost = computed(
  () => `${group.subdomain.trim().toLowerCase() || 'your-group'}.${config.apexDomain}`,
)

const digits = computed(() => fractionDigits(group.currency))
const defaultAmounts = computed(() => defaultAmountRange(group.currency))
const amountPlaceholder = (minorUnits: number): string =>
  fromMinorUnits(minorUnits, group.currency).toFixed(digits.value)
const formatAmount = (minorUnits: number): string =>
  n(fromMinorUnits(minorUnits, group.currency), { key: 'currency', currency: group.currency })

function payload(): GroupJSONUp {
  const attributes: GroupJSONUp = {
    name: group.name,
    subdomain: group.subdomain.trim().toLowerCase(),
    currency: group.currency,
  }
  if (group.minAmount !== null) {
    attributes.min_amount_cents = toMinorUnits(group.minAmount, group.currency)
  }
  if (group.maxAmount !== null) {
    attributes.max_amount_cents = toMinorUnits(group.maxAmount, group.currency)
  }
  return attributes
}

const { submitHandler, errors, error, isProcessing } = useFormErrorHandling(
  () => groupsStore.createGroup(payload()),
  (created) => {
    // A full page load (rather than a router push) on the new subdomain
    // exercises cookie hydration the same way a returning member would.
    window.location.assign(groupURL(created.subdomain))
  },
)

const errorMessage = computed<string | null>(() =>
  error.value === null ? null : t('groupsNew.error', { error: error.value }),
)

const submitDisabled = computed(
  () =>
    isProcessing.value ||
    availability.value === 'invalid' ||
    availability.value === 'reserved' ||
    availability.value === 'taken',
)

const URL = `${config.APIURL}/groups`
</script>

<template>
  <main id="main-content" class="auth-view">
    <h1>{{ t('groupsNew.title') }}</h1>

    <Message v-if="error" severity="error" class="inline-message" data-testid="group-error">
      {{ errorMessage }}
    </Message>

    <sticker-card>
      <form method="post" :action="URL" @submit.prevent="submitHandler">
        <form-field
          v-model="group.name"
          type="text"
          object="group"
          field="name"
          :errors="errors"
          :label="t('groupsNew.name')"
          required
          data-testid="group-name"
        />

        <form-field
          v-model="group.subdomain"
          type="text"
          object="group"
          field="subdomain"
          :errors="errors"
          :label="t('groupsNew.subdomain')"
          required
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          data-testid="group-subdomain"
          @input="subdomainEdited = true"
        />
        <p class="hint">{{ t('groupsNew.subdomainHint', { host: previewHost }) }}</p>
        <p
          v-if="availability !== 'idle'"
          :class="availability === 'available' ? 'available' : 'hint'"
          data-testid="subdomain-availability"
          :data-status="availability"
        >
          {{ t(`groupsNew.availability.${availability}`) }}
        </p>

        <div class="form-field">
          <label for="group-currency">{{ t('groupsNew.currency') }}</label>
          <Select
            v-model="group.currency"
            label-id="group-currency"
            :options="CURRENCIES"
            :invalid="(errors.currency?.length ?? 0) > 0"
            fluid
            data-testid="group-currency"
          />
          <field-errors field="currency" :messages="errors.currency ?? []" />
        </div>

        <money-field
          v-model="group.minAmount"
          :currency="group.currency"
          input-id="group-min_amount_cents"
          field="min_amount_cents"
          :label="t('groupsNew.minAmount')"
          :placeholder="amountPlaceholder(defaultAmounts.minCents)"
          :errors="errors"
          testid="group-min-amount"
        />

        <money-field
          v-model="group.maxAmount"
          :currency="group.currency"
          input-id="group-max_amount_cents"
          field="max_amount_cents"
          :label="t('groupsNew.maxAmount')"
          :placeholder="amountPlaceholder(defaultAmounts.maxCents)"
          :errors="errors"
          testid="group-max-amount"
        />
        <p class="hint">
          {{
            t('groupsNew.amountsHint', {
              min: formatAmount(defaultAmounts.minCents),
              max: formatAmount(defaultAmounts.maxCents),
            })
          }}
        </p>

        <div class="actions">
          <Button
            type="submit"
            :label="t('groupsNew.button')"
            :disabled="submitDisabled"
            data-testid="group-submit"
          />
        </div>
      </form>
    </sticker-card>
  </main>
</template>

<style scoped lang="scss">
.available {
  color: var(--p-primary-color);
}
</style>
