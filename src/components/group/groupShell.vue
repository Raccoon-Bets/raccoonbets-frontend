<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import config from '@/config'
import { groupSlug } from '@/config/tenant'
import RaccoonMascot from '@/components/mascot/raccoonMascot.vue'
import StickerPill from '@/components/sticker/stickerPill.vue'
import UserMenu from '@/components/userMenu.vue'
import { useGroupStore } from '@/stores/modules/group'

interface Props {
  /** Optional data-testid for the group-name heading (the feed passes `feed-title`). */
  titleTestid?: string
}

withDefaults(defineProps<Props>(), { titleTestid: undefined })

const { t } = useI18n()
const route = useRoute()
const groupStore = useGroupStore()

const host = `${groupSlug ?? ''}.${config.apexDomain}`
const isAdmin = computed(() => groupStore.membership?.role === 'admin')

interface NavItem {
  name: string
  label: string
  testid: string | undefined
}

const navItems = computed<NavItem[]>(() => [
  { name: 'feed', label: t('feed.feedLink'), testid: undefined },
  { name: 'myPositions', label: t('feed.myPositionsLink'), testid: 'my-positions-link' },
  { name: 'members', label: t('feed.membersLink'), testid: 'members-link' },
  { name: 'settleUp', label: t('feed.settleUpLink'), testid: 'settle-up-link' },
  ...(isAdmin.value
    ? [{ name: 'settings', label: t('feed.settingsLink'), testid: 'settings-link' }]
    : []),
])
</script>

<template>
  <div class="group-shell">
    <header class="top-bar">
      <div class="wordmark">
        <raccoon-mascot pose="logo" :size="36" />
        <h1 :data-testid="titleTestid">
          {{ groupStore.group?.name ?? groupSlug }}
          <small>{{ host }}</small>
        </h1>
      </div>
      <user-menu data-testid="group-current-user" />
    </header>

    <nav class="group-nav">
      <sticker-pill
        v-for="item in navItems"
        :key="item.name"
        :to="{ name: item.name }"
        :active="route.name === item.name"
        :data-testid="item.testid"
      >
        {{ item.label }}
      </sticker-pill>
    </nav>

    <slot />
  </div>
</template>

<style scoped lang="scss">
.top-bar {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);
}

.wordmark {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;

  h1 {
    margin: 0;
  }

  small {
    display: block;
    font-family: var(--rb-font-body);
    line-height: 1;
  }
}

.group-nav {
  display: flex;
  gap: var(--spacing-sm);
  padding-bottom: var(--spacing-xs);
  margin-bottom: var(--spacing-lg);
  overflow-x: auto;
}
</style>
