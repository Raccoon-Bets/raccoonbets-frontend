<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import Message from 'primevue/message'
import requireAuth from '@/composables/requireAuth'
import StickerButton from '@/components/sticker/stickerButton.vue'
import StickerCard from '@/components/sticker/stickerCard.vue'
import UserMenu from '@/components/userMenu.vue'
import { useGroupsStore } from '@/stores/modules/groups'
import groupURL from '@/utils/groupURL'

const { t } = useI18n()
const groupsStore = useGroupsStore()
requireAuth()

onMounted(async () => {
  await groupsStore.loadMyGroups()
})
</script>

<template>
  <main id="main-content" class="auth-view">
    <user-menu />
    <h1>{{ t('groups.title') }}</h1>

    <p v-if="groupsStore.myGroupsLoading">{{ t('messages.loading') }}</p>

    <Message
      v-else-if="groupsStore.myGroupsError"
      severity="error"
      class="inline-message"
      data-testid="groups-error"
    >
      {{ t('groups.error', { error: groupsStore.myGroupsError.message }) }}
    </Message>

    <template v-else-if="groupsStore.myGroups">
      <p v-if="groupsStore.myGroups.length === 0" data-testid="groups-empty">
        {{ t('groups.empty') }}
      </p>
      <ul v-else data-testid="groups-list" class="groups-list">
        <li v-for="group in groupsStore.myGroups" :key="group.subdomain">
          <sticker-card class="detail-section">
            <a :href="groupURL(group.subdomain)" :data-testid="`group-link-${group.subdomain}`">
              {{ group.name }}
            </a>
          </sticker-card>
        </li>
      </ul>
    </template>

    <sticker-button :to="{ name: 'groupsNew' }" variant="ghost" data-testid="groups-new-link">
      {{ t('groups.newLink') }}
    </sticker-button>
  </main>
</template>

<style scoped lang="scss">
.groups-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}
</style>
