<script setup lang="ts">
import Message from 'primevue/message'

interface Props {
  /** The Rails-style field name the errors belong to. */
  field: string

  /** The backend validation errors for that field. */
  messages: string[]
}

defineProps<Props>()
</script>

<template>
  <Message
    v-if="messages.length > 0"
    severity="error"
    size="small"
    variant="simple"
    data-testid="field-errors"
    :data-name="field"
  >
    <ul>
      <li v-for="message in messages" :key="message">{{ message }}</li>
    </ul>
  </Message>
</template>

<style scoped lang="scss">
ul {
  padding-left: var(--spacing-md);
  margin: var(--spacing-xs) 0 0;
}
</style>
