<script setup lang="ts">
import { computed } from 'vue'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import InputNumber from 'primevue/inputnumber'
import FieldErrors from '@/components/fieldErrors.vue'
import type { Errors } from '@/stores/types'
import { currencySymbol, fractionDigits } from '@/utils/currency'

interface Props {
  /** The input's `id`, also used to associate the label. */
  inputId: string

  /** The Rails-style field name, used to surface backend validation errors. */
  field: string

  /** The label text. */
  label: string

  /** The ISO 4217 currency code whose symbol prefixes the field and sets its precision. */
  currency: string

  /** Backend validation errors keyed by field name. */
  errors?: Errors

  /** Placeholder shown while the field is empty (a decimal major-unit string). */
  placeholder?: string

  /** A `data-testid` applied to the underlying text input. */
  testid?: string
}

const props = withDefaults(defineProps<Props>(), {
  errors: undefined,
  placeholder: undefined,
  testid: undefined,
})

// Amounts are entered as decimal major units and converted to integer minor
// units by the caller; `null` means the field is empty.
const modelValue = defineModel<number | null>({ default: null })

const symbol = computed(() => currencySymbol(props.currency))
const digits = computed(() => fractionDigits(props.currency))
const errorMessages = computed(() => props.errors?.[props.field] ?? [])
const hasError = computed(() => errorMessages.value.length > 0)

// The symbol lives in a sibling addon that isn't part of the input's accessible
// name, so name the currency in an aria-label — restoring the screen-reader
// context the dropped "in {currency}" label text used to carry.
const ariaLabel = computed(() => `${props.label} (${props.currency})`)
const pt = computed(() => ({
  pcInputText: {
    root: {
      'aria-label': ariaLabel.value,
      ...(props.testid === undefined ? {} : { 'data-testid': props.testid }),
    },
  },
}))
</script>

<template>
  <div class="form-field">
    <label :for="inputId">{{ label }}</label>
    <InputGroup>
      <InputGroupAddon>{{ symbol }}</InputGroupAddon>
      <InputNumber
        v-model="modelValue"
        :input-id="inputId"
        :min="0"
        :max-fraction-digits="digits"
        :placeholder="placeholder"
        :invalid="hasError"
        fluid
        :pt="pt"
      />
    </InputGroup>
    <field-errors :field="field" :messages="errorMessages" />
  </div>
</template>
