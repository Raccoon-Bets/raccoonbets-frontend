<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Message from 'primevue/message'
import AuthCard from '@/components/authCard.vue'
import requireAuth from '@/composables/requireAuth'
import { useAuthStore } from '@/stores/modules/auth'
import { decideConsent, denyConsent, loadConsent, type Consent } from '@/services/mcp'
import { errorToString } from '@/utils/errors'

const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const consent = ref<Consent | null>(null)
const consentId = ref<string | null>(null)
const selectedGroups = ref<number[]>([])
const write = ref(false)
const busy = ref(false)
const clientHost = computed(() => (consent.value ? new URL(consent.value.redirect_uri).host : ''))
const error = ref<string | null>(null)
requireAuth()

watch(
  () => [auth.loggedIn, route.params.requestId] as const,
  async ([loggedIn, id], _, onCleanup) => {
    const load = { cancelled: false }
    onCleanup(() => {
      load.cancelled = true
    })
    consentId.value = null
    consent.value = null
    selectedGroups.value = []
    write.value = false
    if (!loggedIn || typeof id !== 'string') return
    error.value = null
    try {
      const details = await loadConsent(id)
      if (load.cancelled) return
      consent.value = details
      consentId.value = id
    } catch (cause) {
      if (!load.cancelled) error.value = errorToString(cause)
    }
  },
  { immediate: true },
)

async function decide(approve: boolean): Promise<void> {
  const id = consentId.value
  if (busy.value || !auth.loggedIn || !id || id !== route.params.requestId) return
  busy.value = true
  error.value = null
  try {
    const redirect = approve
      ? await decideConsent(id, selectedGroups.value, write.value)
      : await denyConsent(id)
    window.location.assign(redirect)
  } catch (cause) {
    error.value = errorToString(cause)
    busy.value = false
  }
}
</script>

<template>
  <main id="main-content" class="auth-view">
    <auth-card>
      <h1>{{ t('mcp.consentTitle') }}</h1>
      <Message v-if="error" severity="error" role="alert">{{ error }}</Message>
      <template v-if="consent">
        <p>{{ t('mcp.requestedBy', { name: consent.client_name }) }}</p>
        <p>{{ t('mcp.clientIdentity', { host: clientHost }) }}</p>
        <p>{{ t('mcp.readDescription') }}</p>
        <form @submit.prevent="decide(true)">
          <fieldset :disabled="busy">
            <legend>{{ t('mcp.chooseGroups') }}</legend>
            <label v-for="group in consent.groups" :key="group.id" class="consent-choice">
              <input v-model="selectedGroups" type="checkbox" :value="group.id" />
              {{ group.name }}
            </label>
            <p v-if="consent.groups.length === 0">{{ t('mcp.noGroups') }}</p>
          </fieldset>
          <label v-if="consent.write_requested" class="consent-choice">
            <input v-model="write" type="checkbox" :disabled="busy" />
            {{ t('mcp.allowWrites') }}
          </label>
          <p v-if="write">{{ t('mcp.writeDescription') }}</p>
          <p>{{ t('mcp.consentDuration') }}</p>
          <div class="actions">
            <Button
              type="submit"
              :label="t('mcp.connect')"
              :disabled="busy || selectedGroups.length === 0"
            />
            <Button
              type="button"
              severity="secondary"
              :label="t('mcp.deny')"
              :disabled="busy"
              @click="decide(false)"
            />
          </div>
        </form>
      </template>
      <p v-else-if="!error">{{ t('messages.loading') }}</p>
    </auth-card>
  </main>
</template>

<style scoped>
.consent-choice {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-block: 1rem;
}
</style>
