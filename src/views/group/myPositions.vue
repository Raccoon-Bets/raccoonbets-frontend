<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import GroupShell from '@/components/group/groupShell.vue'
import StickerBadge from '@/components/sticker/stickerBadge.vue'
import StickerCard from '@/components/sticker/stickerCard.vue'
import useGroupGuard from '@/composables/useGroupGuard'
import useMoney from '@/composables/useMoney'
import { useGroupStore } from '@/stores/modules/group'
import { useMarketsStore } from '@/stores/modules/markets'
import { useSettlementStore } from '@/stores/modules/settlement'
import type { Market } from '@/types'
import { marketPath } from '@/utils/marketURL'

const { t, d } = useI18n()
const groupStore = useGroupStore()
const marketsStore = useMarketsStore()
const settlementStore = useSettlementStore()
const { format } = useMoney()
useGroupGuard()

watch(
  () => groupStore.isMember,
  (isMember) => {
    if (!isMember) return
    void marketsStore.loadMarkets()
    void settlementStore.loadBalances()
  },
  { immediate: true },
)

const myBalance = computed(() => {
  const membershipId = groupStore.membership?.id
  if (membershipId === undefined) return null
  return settlementStore.balances?.find((balance) => balance.membershipId === membershipId) ?? null
})

const myMarkets = computed(() =>
  (marketsStore.markets ?? []).filter((market) => market.myPosition !== null),
)
const openPositions = computed(() => myMarkets.value.filter((market) => market.status === 'open'))
const pastPositions = computed(() => myMarkets.value.filter((market) => market.status !== 'open'))

function outcomeName(market: Market): string {
  return market.outcomes.find((outcome) => outcome.id === market.myPosition?.outcomeId)?.name ?? ''
}

function amountLine(market: Market): string {
  return t('myPositions.amount', {
    amount: format(market.myPosition?.amountCents ?? 0, market.currency),
    outcome: outcomeName(market),
  })
}
</script>

<template>
  <main id="main-content" class="group-view">
    <group-shell>
      <h2>{{ t('myPositions.title') }}</h2>

      <Message v-if="settlementStore.balancesError" severity="error" class="inline-message">
        {{ t('myPositions.balanceError', { error: settlementStore.balancesError.message }) }}
      </Message>
      <Message v-if="marketsStore.marketsError" severity="error" class="inline-message">
        {{ t('myPositions.error', { error: marketsStore.marketsError.message }) }}
      </Message>
      <p v-if="marketsStore.marketsLoading">{{ t('messages.loading') }}</p>

      <sticker-card v-if="myBalance !== null" class="detail-section">
        <i18n-t keypath="myPositions.balance" tag="p" class="balance" data-testid="my-balance">
          <template #amount>
            <sticker-badge :tilt="0" :tone="myBalance.balanceCents >= 0 ? 'positive' : 'negative'">
              {{ format(myBalance.balanceCents, groupStore.group?.currency ?? 'USD') }}
            </sticker-badge>
          </template>
        </i18n-t>
      </sticker-card>

      <template v-if="marketsStore.markets !== null">
        <sticker-card class="detail-section">
          <h2 class="section-head">{{ t('myPositions.openTitle') }}</h2>
          <p v-if="openPositions.length === 0" data-testid="my-positions-open-empty">
            {{ t('myPositions.openEmpty') }}
          </p>
          <ul class="positions">
            <li
              v-for="market in openPositions"
              :key="market.id"
              :data-testid="`my-position-${market.id}`"
            >
              <router-link
                class="name"
                :to="{ name: 'marketDetail', params: { marketId: marketPath(market) } }"
              >
                {{ market.title }}
              </router-link>
              <span>{{ amountLine(market) }}</span>
              <small>{{ t('myPositions.locksAt', { date: d(market.locksAt, 'long') }) }}</small>
            </li>
          </ul>
        </sticker-card>

        <sticker-card class="detail-section">
          <h2 class="section-head">{{ t('myPositions.pastTitle') }}</h2>
          <p v-if="pastPositions.length === 0" data-testid="my-positions-past-empty">
            {{ t('myPositions.pastEmpty') }}
          </p>
          <ul class="positions">
            <li
              v-for="market in pastPositions"
              :key="market.id"
              :data-testid="`my-position-${market.id}`"
            >
              <router-link
                class="name"
                :to="{ name: 'marketDetail', params: { marketId: marketPath(market) } }"
              >
                {{ market.title }}
              </router-link>
              <span>{{ amountLine(market) }}</span>
              <Tag
                :severity="market.status === 'resolved' ? 'success' : 'secondary'"
                :value="t(`market.badge.${market.status}`)"
              />
            </li>
          </ul>
        </sticker-card>
      </template>
    </group-shell>
  </main>
</template>

<style scoped lang="scss">
.balance {
  margin: 0;
}

ul.positions {
  padding: 0;
  margin: 0;
  list-style: none;

  li {
    display: flex;
    gap: var(--spacing-md);
    align-items: baseline;
    padding: var(--spacing-xs) 0;
    border-bottom: 1px solid var(--p-content-border-color);

    .name {
      flex: 1;
      min-width: 12rem;
      font-weight: 600;
    }
  }
}
</style>
