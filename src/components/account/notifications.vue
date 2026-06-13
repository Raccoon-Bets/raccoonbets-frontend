<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import { useAccountStore } from '@/stores/modules/account'
import { ensurePushSubscription } from '@/composables/usePushNotifications'
import { notifySentry } from '@/utils/errors'
import type { ChannelToggles, NotificationEvent, NotificationPreferences } from '@/types'

const EVENTS: NotificationEvent[] = [
  'market_resolved',
  'market_created',
  'settlement',
  'market_closing_soon',
  'market_commented',
]

const { t } = useI18n()
const accountStore = useAccountStore()

// Builds an editable copy where every event x channel is resolved to a concrete
// boolean. A missing key defaults to ON, mirroring the backend value object.
function effective(prefs: NotificationPreferences): Record<NotificationEvent, ChannelToggles> {
  return Object.fromEntries(
    EVENTS.map((event) => [
      event,
      { email: prefs[event]?.email !== false, push: prefs[event]?.push !== false },
    ]),
  ) as Record<NotificationEvent, ChannelToggles>
}

const model = reactive(effective(accountStore.currentUser?.notificationPreferences ?? {}))

watch(
  () => accountStore.currentUser?.notificationPreferences,
  (prefs) => Object.assign(model, effective(prefs ?? {})),
)

async function save(): Promise<void> {
  await accountStore.updateNotificationPreferences(model)
}

async function enableOnDevice(): Promise<void> {
  const key = accountStore.currentUser?.vapidPublicKey
  if (key) await ensurePushSubscription(key).catch(notifySentry)
}

const pushPermission = computed(() =>
  'Notification' in window ? Notification.permission : 'unsupported',
)

// Only offer to enable push when it can actually be requested and the server
// has a VAPID key to subscribe against.
const canEnablePush = computed(
  () => pushPermission.value === 'default' && Boolean(accountStore.currentUser?.vapidPublicKey),
)
</script>

<template>
  <section data-testid="notifications-section">
    <h2>{{ t('account.notifications.title') }}</h2>
    <p>{{ t('account.notifications.description') }}</p>

    <p v-if="pushPermission === 'denied'" data-testid="push-denied">
      {{ t('account.notifications.pushDenied') }}
    </p>

    <Button
      v-if="canEnablePush"
      :label="t('account.notifications.enableOnDevice')"
      data-testid="enable-push-device"
      @click="enableOnDevice"
    />

    <table>
      <thead>
        <tr>
          <th>{{ t('account.notifications.event') }}</th>
          <th>{{ t('account.notifications.email') }}</th>
          <th>{{ t('account.notifications.push') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="event in EVENTS" :key="event">
          <td>{{ t(`account.notifications.events.${event}`) }}</td>
          <td>
            <Checkbox
              v-model="model[event].email"
              binary
              :data-testid="`pref-${event}-email`"
              @change="save"
            />
          </td>
          <td>
            <Checkbox
              v-model="model[event].push"
              binary
              :data-testid="`pref-${event}-push`"
              @change="save"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped lang="scss">
table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: var(--spacing-sm);
  text-align: left;
  border-bottom: 1px solid var(--p-content-border-color);
}

th + th,
td + td {
  text-align: center;
}
</style>
