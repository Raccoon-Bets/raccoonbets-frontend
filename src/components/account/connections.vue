<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import type { McpConnection } from '@/types'
import { useAuthStore } from '@/stores/modules/auth'
import { useMcpConnectionsStore } from '@/stores/modules/mcpConnections'
import { errorToString } from '@/utils/errors'

const { t, d } = useI18n()
const auth = useAuthStore()
const mcpConnections = useMcpConnectionsStore()
const error = ref<string | null>(null)
const success = ref<string | null>(null)

const listing = computed(() => mcpConnections.connections)
const loadError = computed(() => mcpConnections.connectionsError?.message ?? null)

function clearMessages(): void {
  error.value = null
  success.value = null
}

watch(
  () => auth.loggedIn,
  async (loggedIn) => {
    clearMessages()
    mcpConnections.reset()
    if (loggedIn) await mcpConnections.loadConnections()
  },
  { immediate: true },
)

async function copyServerURL(url: string): Promise<void> {
  clearMessages()
  try {
    await navigator.clipboard.writeText(url)
    success.value = t('account.connections.copied')
  } catch {
    error.value = t('account.connections.copyError')
  }
}

function selectAll(event: FocusEvent): void {
  if (event.target instanceof HTMLInputElement) event.target.select()
}

async function revoke(connection: McpConnection): Promise<void> {
  clearMessages()
  const name = connection.clientName
  if (!window.confirm(t('account.connections.confirmRevoke', { name }))) return
  try {
    await mcpConnections.revoke(connection)
    success.value = t('account.connections.revoked', { name })
  } catch (cause) {
    error.value = errorToString(cause)
  }
}

function describe(connection: McpConnection): string {
  return [
    t('account.connections.groups', {
      groups: connection.groups.map(({ name }) => name).join(', '),
    }),
    t(connection.canAct ? 'account.connections.canAct' : 'account.connections.readOnly'),
    t('account.connections.expires', { date: d(connection.expiresAt, 'short') }),
  ].join(' · ')
}
</script>

<template>
  <section aria-labelledby="connections-title" data-testid="connections-section">
    <h2 id="connections-title">{{ t('account.connections.title') }}</h2>

    <Message v-if="loadError" severity="error" role="alert" class="inline-message">
      {{ loadError }}
    </Message>

    <p v-if="mcpConnections.connectionsLoading" class="hint" role="status">
      {{ t('messages.loading') }}
    </p>

    <template v-if="listing">
      <template v-if="listing.enabled">
        <p>
          {{ t('account.connections.setup') }}
          <router-link :to="{ name: 'assistants' }">
            {{ t('account.connections.instructions') }}
          </router-link>
        </p>
        <div class="server-url">
          <InputText
            :model-value="listing.serverURL"
            readonly
            fluid
            :aria-label="t('account.connections.serverURL')"
            data-testid="connections-server-url"
            @focus="selectAll"
          />
          <Button
            type="button"
            severity="secondary"
            :label="t('account.connections.copy')"
            @click="copyServerURL(listing.serverURL)"
          />
        </div>
        <p class="hint">{{ t('account.connections.reconnect') }}</p>
      </template>
      <p v-else>{{ t('account.connections.unavailable') }}</p>

      <p v-if="listing.connections.length === 0">{{ t('account.connections.empty') }}</p>
      <ul v-else>
        <li v-for="connection in listing.connections" :key="connection.id">
          <div class="details">
            <h3>{{ connection.clientName }}</h3>
            <small>{{ describe(connection) }}</small>
          </div>
          <Button
            type="button"
            size="small"
            severity="danger"
            outlined
            :label="t('account.connections.revoke')"
            :aria-label="t('account.connections.revokeNamed', { name: connection.clientName })"
            :loading="mcpConnections.revokingID === connection.id"
            :disabled="mcpConnections.revokingID !== null"
            @click="revoke(connection)"
          />
        </li>
      </ul>
    </template>

    <Message v-if="error" severity="error" role="alert" class="inline-message">
      {{ error }}
    </Message>
    <Message v-if="success" severity="success" class="inline-message">
      {{ success }}
    </Message>
  </section>
</template>

<style scoped lang="scss">
.server-url {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  min-width: 0;
}

ul {
  padding: 0;
  list-style: none;
}

li {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) 0;
  border-bottom: 1px solid var(--p-content-border-color);
}

.details {
  min-width: 0;

  h3 {
    margin: 0;
    overflow-wrap: anywhere;
  }
}
</style>
