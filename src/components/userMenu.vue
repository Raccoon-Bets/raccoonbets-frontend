<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import type { MenuMethods } from 'primevue/menu'
import { notifySentry } from '@/utils/errors'
import { useAuthStore } from '@/stores/modules/auth'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

const menu = useTemplateRef<MenuMethods>('menu')

async function logOut(): Promise<void> {
  try {
    await authStore.logOut()
  } catch (error) {
    // The server-side revocation failing shouldn't trap the user in a
    // session; the local reset already happened or will happen below.
    notifySentry(error)
    authStore.reset()
  }
  await router.push({ name: 'logIn' })
}

const items = computed(() => [
  {
    label: t('userMenu.logOut'),
    testid: 'logout-button',
    command: () => void logOut(),
  },
])
</script>

<template>
  <div v-if="authStore.loggedIn" class="user-menu">
    <Button
      type="button"
      severity="secondary"
      variant="text"
      size="small"
      icon="pi pi-user"
      :label="authStore.currentEmail ?? undefined"
      data-testid="current-user-email"
      aria-haspopup="true"
      aria-controls="user-menu-items"
      @click="menu?.toggle($event)"
    />
    <Menu id="user-menu-items" ref="menu" :model="items" popup>
      <template #item="{ item, props }">
        <a v-bind="props.action" :data-testid="item.testid">{{ item.label }}</a>
      </template>
    </Menu>
  </div>
</template>
