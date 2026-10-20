<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Message from 'primevue/message'
import config from '@/config'
import { useAuthStore } from '@/stores/modules/auth'
import { loadConnections, revokeConnection, type Connections } from '@/services/mcp'
import { errorToString } from '@/utils/errors'

const { t, d } = useI18n()
const auth = useAuthStore()
const data = ref<Connections | null>(null)
const error = ref<string | null>(null)
const revoking = ref<number | null>(null)
const endpoint = `${config.APIURL}/mcp`

watch(
  () => auth.loggedIn,
  async (loggedIn) => {
    data.value = null
    if (!loggedIn) return
    try {
      data.value = await loadConnections()
    } catch (cause) {
      error.value = errorToString(cause)
    }
  },
  { immediate: true },
)

async function revoke(id: number): Promise<void> {
  revoking.value = id
  error.value = null
  try {
    await revokeConnection(id)
    data.value = await loadConnections()
  } catch (cause) {
    error.value = errorToString(cause)
  } finally {
    revoking.value = null
  }
}
</script>

<template>
  <section aria-labelledby="connections-title">
    <h2 id="connections-title">{{ t('mcp.connectionsTitle') }}</h2>
    <Message v-if="error" severity="error" role="alert">{{ error }}</Message>
    <template v-if="data">
      <template v-if="data.enabled">
        <p>{{ t('mcp.setup') }}</p>
        <code>{{ endpoint }}</code>
        <p>{{ t('mcp.reconnect') }}</p>
      </template>
      <p v-else>{{ t('mcp.unavailable') }}</p>
      <p v-if="data.connections.length === 0">{{ t('mcp.noConnections') }}</p>
      <article v-for="connection in data.connections" :key="connection.id" class="connection">
        <h3>{{ connection.client_name }}</h3>
        <p>{{ connection.groups.map((group) => group.name).join(', ') }}</p>
        <p>{{ t(connection.scopes.includes('mcp:write') ? 'mcp.readWrite' : 'mcp.readOnly') }}</p>
        <p v-if="connection.revoked_at">{{ t('mcp.revoked') }}</p>
        <p v-else-if="Date.parse(connection.expires_at) <= Date.now()">{{ t('mcp.expired') }}</p>
        <template v-else>
          <p>{{ t('mcp.expires', { date: d(new Date(connection.expires_at), 'short') }) }}</p>
          <Button
            :label="t('mcp.revoke')"
            severity="danger"
            outlined
            :disabled="revoking !== null"
            @click="revoke(connection.id)"
          />
        </template>
      </article>
    </template>
  </section>
</template>

<style scoped>
.connection + .connection {
  margin-block-start: 1.5rem;
}
</style>
