<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Message from 'primevue/message'
import GroupShell from '@/components/group/groupShell.vue'
import MarketCard from '@/components/group/marketCard.vue'
import RaccoonMascot from '@/components/mascot/raccoonMascot.vue'
import StickerFab from '@/components/sticker/stickerFab.vue'
import { groupSlug } from '@/config/tenant'
import useChannel, { channelEventSchema } from '@/composables/useChannel'
import useGroupGuard from '@/composables/useGroupGuard'
import { useGroupStore } from '@/stores/modules/group'
import { useMarketsStore } from '@/stores/modules/markets'

const { t } = useI18n()
const router = useRouter()
const groupStore = useGroupStore()
const marketsStore = useMarketsStore()
useGroupGuard()

watch(
  () => groupStore.isMember,
  (isMember) => {
    if (isMember) void marketsStore.loadMarkets()
  },
  { immediate: true },
)

// Live updates: any market event (created/updated/resolved/voided/corrected,
// including pool changes from positions) refreshes the feed. Settlement and
// membership events don't affect anything shown here.
useChannel({
  channel: 'GroupChannel',
  params: () => (groupStore.isMember && groupSlug !== null ? { group: groupSlug } : null),
  schema: channelEventSchema,
  received: (event) => {
    if (event.type.startsWith('market_')) void marketsStore.loadMarkets()
  },
})

const openMarkets = computed(() =>
  (marketsStore.markets ?? []).filter((market) => market.status === 'open' && !market.locked),
)
const lockedMarkets = computed(() =>
  (marketsStore.markets ?? []).filter((market) => market.status === 'open' && market.locked),
)
const concludedMarkets = computed(() =>
  (marketsStore.markets ?? []).filter((market) => market.status !== 'open'),
)
</script>

<template>
  <main id="main-content" class="group-view">
    <group-shell title-testid="feed-title">
      <Message v-if="groupStore.groupError" severity="error" class="inline-message">
        {{ t('group.loadError', { error: groupStore.groupError.message }) }}
      </Message>
      <Message
        v-if="marketsStore.marketsError"
        severity="error"
        class="inline-message"
        data-testid="feed-error"
      >
        {{ t('feed.error', { error: marketsStore.marketsError.message }) }}
      </Message>
      <p v-if="groupStore.groupLoading || marketsStore.marketsLoading">
        {{ t('messages.loading') }}
      </p>

      <template v-if="marketsStore.markets !== null">
        <section>
          <h2 class="section-head">{{ t('feed.openTitle') }}</h2>
          <div v-if="openMarkets.length === 0" class="empty" data-testid="feed-open-empty">
            <raccoon-mascot pose="shrug" :size="72" />
            <p>{{ t('feed.openEmpty') }}</p>
          </div>
          <market-card v-for="market in openMarkets" :key="market.id" :market="market" />
        </section>

        <section v-if="lockedMarkets.length > 0">
          <h2 class="section-head">{{ t('feed.lockedTitle') }}</h2>
          <market-card v-for="market in lockedMarkets" :key="market.id" :market="market" />
        </section>

        <section v-if="concludedMarkets.length > 0">
          <h2 class="section-head">{{ t('feed.concludedTitle') }}</h2>
          <market-card v-for="market in concludedMarkets" :key="market.id" :market="market" />
        </section>
      </template>

      <sticker-fab
        :aria-label="t('feed.newMarketLink')"
        data-testid="new-market-link"
        @click="void router.push({ name: 'marketsNew' })"
      >
        +
      </sticker-fab>
    </group-shell>
  </main>
</template>

<style scoped lang="scss">
main {
  padding-bottom: calc(56px + 2 * var(--spacing-lg));
}

.empty {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
  color: var(--rb-muted);
}

section {
  margin-bottom: var(--spacing-lg);
}
</style>
