<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Market } from '@/types'
import OutcomeRow from '@/components/sticker/outcomeRow.vue'
import StickerBadge from '@/components/sticker/stickerBadge.vue'
import StickerCard from '@/components/sticker/stickerCard.vue'
import useCountdown, { type CountdownUrgency } from '@/composables/useCountdown'
import useMoney from '@/composables/useMoney'
import { global } from '@/i18n'
import { formatMultiplier, payoutMultiplier } from '@/utils/parimutuel'
import { marketPath } from '@/utils/marketURL'

interface Props {
  /** The market to summarize. */
  market: Market
}

const props = defineProps<Props>()

const { t } = useI18n()
const { format } = useMoney()
const { countdown, urgency } = useCountdown(() => props.market.locksAt ?? new Date(0))

const isScheduled = computed(
  () => props.market.kind === 'scheduled' && props.market.locksAt !== null,
)

// Normal urgency keeps the pill on brand; warning/alert escalate as lock approaches.
const LOCK_PILL_TONES: Record<CountdownUrgency, 'primary' | 'warning' | 'alert'> = {
  normal: 'primary',
  warning: 'warning',
  alert: 'alert',
}
const lockPillTone = computed(() => LOCK_PILL_TONES[urgency.value])

const openForTrading = computed(() => props.market.status === 'open' && !props.market.locked)
const badge = computed(() =>
  props.market.status === 'open' ? ('locked' as const) : props.market.status,
)
const badgeTone = computed(() => {
  switch (badge.value) {
    case 'resolved':
      return 'positive' as const
    case 'voided':
      return 'muted' as const
    default:
      return 'negative' as const
  }
})
const totalPositionCount = computed(() =>
  props.market.outcomes.reduce((sum, outcome) => sum + outcome.positionCount, 0),
)
const winnerName = computed(
  () =>
    props.market.outcomes.find((outcome) => outcome.id === props.market.winningOutcomeId)?.name ??
    null,
)

function multiplierFor(poolCents: number): string | null {
  const multiplier = payoutMultiplier(props.market.totalPoolCents, poolCents)
  return multiplier === null ? null : formatMultiplier(multiplier, global.locale.value)
}
</script>

<template>
  <sticker-card
    class="market-card"
    :class="{ voided: market.status === 'voided' }"
    :data-testid="`market-card-${market.id}`"
  >
    <sticker-badge v-if="openForTrading && isScheduled" :tone="lockPillTone" overlap>
      {{ t('market.locksIn', { countdown }) }}
    </sticker-badge>
    <sticker-badge v-else-if="openForTrading" tone="primary" overlap>
      {{ t('market.openEnded') }}
    </sticker-badge>
    <sticker-badge v-else :tone="badgeTone" overlap>
      {{ t(`market.badge.${badge}`) }}
    </sticker-badge>

    <h3 class="title">
      <router-link :to="{ name: 'marketDetail', params: { marketId: marketPath(market) } }">
        {{ market.title }}
      </router-link>
    </h3>

    <p class="meta">
      <span>{{ t('market.positionCount', totalPositionCount) }}</span>
      <sticker-badge tone="info" :tilt="0">
        {{ t('market.totalPool', { amount: format(market.totalPoolCents, market.currency) }) }}
      </sticker-badge>
    </p>

    <outcome-row
      v-for="(outcome, index) in market.outcomes"
      :key="outcome.id"
      :label="outcome.name"
      :amount="format(outcome.poolCents, market.currency)"
      :multiplier="multiplierFor(outcome.poolCents)"
      :index="index"
      :dimmed="market.status === 'resolved' && outcome.id !== market.winningOutcomeId"
    >
      <sticker-badge
        v-if="market.status === 'resolved' && outcome.id === market.winningOutcomeId"
        tone="primary"
        :tilt="-3"
      >
        {{ t('market.winner', { name: winnerName }) }}
      </sticker-badge>
    </outcome-row>
  </sticker-card>
</template>

<style scoped lang="scss">
.market-card {
  margin-bottom: var(--spacing-lg);

  &.voided {
    filter: grayscale(1);
  }
}

.title {
  margin: var(--spacing-xs) 0;

  a {
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.meta {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
  margin: 0 0 var(--spacing-md);
  font-size: 13px;
  color: var(--rb-muted);
}
</style>
