<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'
import AuthCard from '@/components/authCard.vue'
import requireAuth from '@/composables/requireAuth'
import { isApex } from '@/config/tenant'
import type { McpConsent } from '@/types'
import { useAuthStore } from '@/stores/modules/auth'
import { useMcpConnectionsStore } from '@/stores/modules/mcpConnections'
import { errorToString, notifySentry } from '@/utils/errors'

const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const mcpConnections = useMcpConnectionsStore()
const consent = ref<McpConsent | null>(null)
const consentID = ref<string | null>(null)
const selectedGroups = ref<number[]>([])
const write = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
requireAuth()

const hasGroups = computed(() => (consent.value?.groups.length ?? 0) > 0)
const canConnect = computed(() => !busy.value && selectedGroups.value.length > 0)

function clearConsent(): void {
  consentID.value = null
  consent.value = null
  selectedGroups.value = []
  write.value = false
}

function showError(cause: unknown): void {
  notifySentry(cause)
  error.value = errorToString(cause)
}

watch(
  () => [auth.loggedIn, route.params.requestId] as const,
  async ([loggedIn, id], _, onCleanup) => {
    const load = { cancelled: false }
    onCleanup(() => {
      load.cancelled = true
    })
    clearConsent()
    if (!loggedIn || typeof id !== 'string') return
    error.value = null
    try {
      const details = await mcpConnections.loadConsent(id)
      if (load.cancelled) return
      consent.value = details
      consentID.value = id
    } catch (cause) {
      if (!load.cancelled) showError(cause)
    }
  },
  { immediate: true },
)

async function decide(approve: boolean): Promise<void> {
  const id = consentID.value
  if (busy.value || !auth.loggedIn || !id || id !== route.params.requestId) return
  busy.value = true
  error.value = null
  try {
    const redirect = approve
      ? await mcpConnections.approve(id, selectedGroups.value, write.value)
      : await mcpConnections.deny(id)
    window.location.assign(redirect)
  } catch (cause) {
    showError(cause)
    busy.value = false
  }
}
</script>

<template>
  <main id="main-content" class="auth-view">
    <auth-card>
      <h1>{{ t('auth.mcpConsent.title') }}</h1>
      <Message v-if="error" severity="error" role="alert" class="inline-message">
        {{ error }}
      </Message>

      <template v-if="consent">
        <p class="hint signed-in-as" data-testid="mcp-consent-account">
          {{
            t('auth.mcpConsent.signedInAs', {
              name: consent.account.name,
              email: consent.account.email,
            })
          }}
        </p>

        <div class="requester">
          <p>
            {{ t('auth.mcpConsent.requestedBy') }}
            <strong class="client-name">{{ consent.clientName }}</strong>
            {{ t('auth.mcpConsent.wantsAccess') }}
          </p>
          <p class="destination">
            {{ t('auth.mcpConsent.destination') }}
            <code data-testid="mcp-consent-host">{{ consent.redirectHost }}</code>
          </p>
          <p class="hint">{{ t('auth.mcpConsent.destinationHint') }}</p>
        </div>

        <p>{{ t('auth.mcpConsent.readDescription') }}</p>

        <form v-if="hasGroups" @submit.prevent="decide(true)">
          <fieldset class="field-group" aria-describedby="mcp-consent-groups-hint">
            <legend>{{ t('auth.mcpConsent.groupsLegend') }}</legend>
            <p id="mcp-consent-groups-hint" class="hint">
              {{ t('auth.mcpConsent.groupsHint') }}
            </p>
            <div v-for="group in consent.groups" :key="group.id" class="choice">
              <Checkbox
                v-model="selectedGroups"
                :input-id="`mcp-consent-group-${group.id}`"
                :value="group.id"
                :disabled="busy"
              />
              <label :for="`mcp-consent-group-${group.id}`">{{ group.name }}</label>
            </div>
          </fieldset>

          <fieldset class="field-group">
            <legend>{{ t('auth.mcpConsent.permissionsLegend') }}</legend>
            <div v-if="consent.writeRequested" class="choice described-choice">
              <Checkbox
                v-model="write"
                binary
                input-id="mcp-consent-write"
                :disabled="busy"
                :pt="{ input: { 'aria-describedby': 'mcp-consent-write-description' } }"
              />
              <div>
                <label for="mcp-consent-write">{{ t('auth.mcpConsent.allowWrites') }}</label>
                <p id="mcp-consent-write-description" class="hint">
                  {{ t('auth.mcpConsent.writeDescription') }}
                </p>
              </div>
            </div>
            <p v-else class="hint">{{ t('auth.mcpConsent.readOnlyRequested') }}</p>
          </fieldset>

          <p class="hint">
            {{ t('auth.mcpConsent.duration', { days: consent.lifetimeDays }) }}
          </p>

          <div class="actions">
            <Button
              type="submit"
              :label="t('auth.mcpConsent.connect')"
              :disabled="!canConnect"
              :loading="busy"
            />
            <Button
              type="button"
              severity="secondary"
              :label="t('auth.mcpConsent.deny')"
              :disabled="busy"
              @click="decide(false)"
            />
          </div>
        </form>

        <template v-else>
          <Message severity="info" class="inline-message">
            {{ t('auth.mcpConsent.noGroups') }}
          </Message>
          <p v-if="isApex">
            <router-link :to="{ name: 'groups' }">
              {{ t('auth.mcpConsent.groupsLink') }}
            </router-link>
          </p>
          <div class="actions">
            <Button
              type="button"
              severity="secondary"
              :label="t('auth.mcpConsent.deny')"
              :disabled="busy"
              @click="decide(false)"
            />
          </div>
        </template>
      </template>

      <p v-else-if="error && isApex">
        <router-link :to="{ name: 'account' }">{{ t('auth.mcpConsent.accountLink') }}</router-link>
      </p>
      <p v-else-if="!error" class="hint" role="status">{{ t('messages.loading') }}</p>
    </auth-card>
  </main>
</template>

<style scoped lang="scss">
.signed-in-as {
  margin-bottom: var(--spacing-sm);
}

.requester {
  padding: var(--spacing-md);
  margin: 0 0 var(--spacing-md);
  border: var(--rb-border-width-control) solid var(--p-content-border-color);
  border-radius: var(--rb-radius-control);

  p {
    margin: 0 0 var(--spacing-xs);
  }

  p.hint {
    margin: 0;
  }
}

.client-name {
  font-family: var(--rb-font-display);
}

.destination code {
  display: inline-block;
  padding: 0 var(--spacing-xs);
  font-weight: 700;
  overflow-wrap: anywhere;
  background-color: var(--rb-warning-bg);
  color: var(--rb-warning-ink);
  border-radius: var(--spacing-xs);
}

.choice {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  margin-block: var(--spacing-sm);
}

.described-choice {
  align-items: flex-start;
}
</style>
