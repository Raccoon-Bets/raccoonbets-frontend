<script setup lang="ts">
import VueTurnstile from 'vue-turnstile'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{ siteKey: string }>()
const token = defineModel<string>({ default: '' })
const widget = ref<InstanceType<typeof VueTurnstile> | null>(null)

const { locale } = useI18n()
// Cloudflare Turnstile expects a base language code (e.g. `de`, `fr`, `en`).
const language = computed(() => locale.value.split('-')[0])

defineExpose({ reset: () => widget.value?.reset() })
</script>

<template>
  <VueTurnstile ref="widget" v-model="token" :site-key="siteKey" :language="language" />
</template>
