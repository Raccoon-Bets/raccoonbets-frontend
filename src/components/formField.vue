<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { InputHTMLAttributes } from 'vue'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import FieldErrors from '@/components/fieldErrors.vue'
import type { Errors } from '@/stores/types'

interface Props {
  /** The input type (`text`, `email`, or `password`). */
  type?: string

  /** The Rails-style object name, used to derive the input's id and name. */
  object: string

  /** The Rails-style field name, used to derive the input's id and name. */
  field: string

  /** The label text. */
  label: string

  /** Backend validation errors keyed by field name. */
  errors?: Errors
}

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  errors: undefined,
})

const modelValue = defineModel<string>({ default: '' })

// Typed view of the fall-through attributes for Password's `inputProps`.
const attrs = useAttrs() as InputHTMLAttributes

const id = computed(() => `${props.object}-${props.field}`)
const name = computed(() => `${props.object}[${props.field}]`)
const errorMessages = computed(() => props.errors?.[props.field] ?? [])
const hasError = computed(() => errorMessages.value.length > 0)
</script>

<template>
  <div class="form-field">
    <label :for="id">{{ label }}</label>

    <!-- Password renders a wrapper element, so pass-through attributes
         (data-testid, autocomplete, …) go to the inner input instead. -->
    <Password
      v-if="type === 'password'"
      v-model="modelValue"
      :input-id="id"
      :name="name"
      :invalid="hasError"
      :feedback="false"
      toggle-mask
      fluid
      :input-props="attrs"
    />
    <InputText
      v-else
      v-bind="$attrs"
      :id="id"
      v-model="modelValue"
      :type="type"
      :name="name"
      :invalid="hasError"
      fluid
    />

    <field-errors :field="field" :messages="errorMessages" />
  </div>
</template>
