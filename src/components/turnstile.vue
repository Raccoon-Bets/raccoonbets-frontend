<script setup lang="ts">
import VueTurnstile from 'vue-turnstile'
import { computed, onErrorCaptured, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Message from 'primevue/message'

defineProps<{ siteKey: string }>()
const token = defineModel<string>({ default: '' })
const widget = ref<InstanceType<typeof VueTurnstile> | null>(null)
const failedToLoad = ref(false)

const { t, locale } = useI18n()
// Cloudflare Turnstile expects a base language code (e.g. `de`, `fr`, `en`).
const language = computed(() => locale.value.split('-')[0])

// vue-turnstile rejects from its own mounted() hook with this message when the
// Cloudflare script can't load (blocked by an extension, offline, or otherwise
// unreachable). Catch it here so it surfaces as a recoverable in-form notice
// rather than an unactionable, stackless error in the global Sentry handler.
onErrorCaptured((err) => {
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes('Failed to load Turnstile')) {
    failedToLoad.value = true
    return false
  }
  return undefined
})

defineExpose({ reset: () => widget.value?.reset() })
</script>

<template>
  <Message
    v-if="failedToLoad"
    severity="error"
    class="inline-message"
    data-testid="turnstile-error"
  >
    {{ t('turnstile.loadError') }}
  </Message>
  <VueTurnstile v-else ref="widget" v-model="token" :site-key="siteKey" :language="language" />
</template>
