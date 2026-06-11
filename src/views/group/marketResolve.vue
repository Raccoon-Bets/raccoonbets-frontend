<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Message from 'primevue/message'
import RadioButton from 'primevue/radiobutton'
import config from '@/config'
import GroupShell from '@/components/group/groupShell.vue'
import StickerCard from '@/components/sticker/stickerCard.vue'
import useChannel, { channelEventSchema } from '@/composables/useChannel'
import useCountdown from '@/composables/useCountdown'
import useFormErrorHandling from '@/composables/useFormErrorHandling'
import useGroupGuard from '@/composables/useGroupGuard'
import { useGroupStore } from '@/stores/modules/group'
import { useMarketStore } from '@/stores/modules/market'
import { groupPath } from '@/stores/modules/root'
import type { Errors } from '@/stores/types'
import { Err, type Result } from 'ts-results'
import { marketPath } from '@/utils/marketURL'
import useCanonicalMarketURL from '@/composables/useCanonicalMarketURL'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const groupStore = useGroupStore()
const marketStore = useMarketStore()
useGroupGuard()

const marketId = computed(() => parseInt(String(route.params.marketId), 10))

watch(
  [() => groupStore.isMember, marketId],
  ([isMember, id]) => {
    if (isMember && Number.isInteger(id)) void marketStore.loadMarket(id)
  },
  { immediate: true },
)

// Live updates: reload on any MarketChannel event so pools and resolution
// state stay current while the oracle deliberates.
useChannel({
  channel: 'MarketChannel',
  params: () =>
    groupStore.isMember && Number.isInteger(marketId.value) ? { id: marketId.value } : null,
  schema: channelEventSchema,
  received: () => void marketStore.loadMarket(marketId.value),
})

const market = computed(() =>
  marketStore.market?.id === marketId.value ? marketStore.market : null,
)

// Canonical `:marketId` for links back to the detail page. Falls back to the
// bare id before the market has loaded; the detail page then self-corrects.
const marketDetailParams = computed(() =>
  market.value === null ? String(marketId.value) : marketPath(market.value),
)

useCanonicalMarketURL(() => market.value)

const isAdmin = computed(() => groupStore.membership?.role === 'admin')
const isOracle = computed(
  () => market.value !== null && market.value.oracle.id === groupStore.membership?.id,
)

// Only the market's oracle or a group admin may act here; everyone else goes
// back to the market detail.
watch([market, () => groupStore.membership], ([loaded, membership]) => {
  if (loaded === null || membership === null) return
  if (!isAdmin.value && !isOracle.value) {
    void router.replace({ name: 'marketDetail', params: { marketId: marketDetailParams.value } })
  }
})

const countdown = useCountdown(() => market.value?.locksAt ?? new Date(0))

const winnerName = computed(() => {
  const winnerId = market.value?.winningOutcomeId ?? null
  if (winnerId === null) return null
  return market.value?.outcomes.find((outcome) => outcome.id === winnerId)?.name ?? null
})

// Which controls apply: resolving needs an open, locked market; correcting
// needs a resolved market and an admin; voiding works on anything not already
// voided.
const canResolveNow = computed(
  () => market.value !== null && market.value.status === 'open' && market.value.locked,
)
const canCorrect = computed(() => market.value?.status === 'resolved' && isAdmin.value)
const canVoid = computed(() => market.value !== null && market.value.status !== 'voided')

const outcomeId = ref<number | null>(null)
const correctableOutcomes = computed(() =>
  (market.value?.outcomes ?? []).filter((outcome) => outcome.id !== market.value?.winningOutcomeId),
)

async function backToMarket(): Promise<void> {
  await router.push({ name: 'marketDetail', params: { marketId: marketDetailParams.value } })
}

async function withChosenOutcome(
  action: (id: number) => Promise<Result<void, Errors>>,
): Promise<Result<void, Errors>> {
  if (outcomeId.value === null) return new Err({ base: [t('error.unknown')] })
  return action(outcomeId.value)
}

const {
  submitHandler: resolveHandler,
  errors: resolveErrors,
  error: resolveError,
  isProcessing: isResolving,
} = useFormErrorHandling(() => withChosenOutcome((id) => marketStore.resolve(id)), backToMarket)

const {
  submitHandler: correctHandler,
  errors: correctErrors,
  error: correctError,
  isProcessing: isCorrecting,
} = useFormErrorHandling(() => withChosenOutcome((id) => marketStore.correct(id)), backToMarket)

const {
  submitHandler: voidSubmitHandler,
  errors: voidErrors,
  error: voidError,
  isProcessing: isVoiding,
} = useFormErrorHandling(async () => marketStore.voidMarket(), backToMarket)

async function voidHandler(): Promise<void> {
  if (window.confirm(t('resolve.voidConfirm'))) await voidSubmitHandler()
}

const actionErrors = computed(() => [
  ...Object.values(resolveErrors.value).flat(),
  ...Object.values(correctErrors.value).flat(),
  ...Object.values(voidErrors.value).flat(),
])
const thrownError = computed(() => resolveError.value ?? correctError.value ?? voidError.value)

const URL = config.APIURL + groupPath(`/markets/${String(marketId.value)}/resolution`)
</script>

<template>
  <main id="main-content" class="group-view">
    <group-shell>
      <Message
        v-if="marketStore.marketNotFound"
        severity="error"
        class="inline-message"
        data-testid="market-not-found"
      >
        {{ t('marketDetail.notFound') }}
      </Message>
      <Message v-if="marketStore.marketError" severity="error" class="inline-message">
        {{ t('marketDetail.error', { error: marketStore.marketError.message }) }}
      </Message>
      <p v-if="market === null && marketStore.marketLoading">{{ t('messages.loading') }}</p>

      <template v-if="market !== null">
        <h2 data-testid="resolve-title">{{ t('resolve.title', { title: market.title }) }}</h2>

        <nav class="back-nav">
          <router-link :to="{ name: 'marketDetail', params: { marketId: marketDetailParams } }">
            {{ t('resolve.backLink') }}
          </router-link>
        </nav>

        <sticker-card>
          <Message
            v-if="thrownError"
            severity="error"
            class="inline-message"
            data-testid="resolve-error"
          >
            {{ t('resolve.error', { error: thrownError }) }}
          </Message>
          <Message
            v-if="actionErrors.length > 0"
            severity="error"
            class="inline-message"
            data-testid="resolve-errors"
          >
            <ul>
              <li v-for="message in actionErrors" :key="message">{{ message }}</li>
            </ul>
          </Message>

          <Message
            v-if="market.status === 'open' && !market.locked"
            severity="info"
            class="inline-message"
            data-testid="still-open"
          >
            {{ t('resolve.stillOpen', { countdown }) }}
          </Message>
          <Message
            v-if="market.status === 'voided'"
            severity="secondary"
            class="inline-message"
            data-testid="already-voided"
          >
            {{ t('resolve.alreadyVoided') }}
          </Message>
          <Message
            v-if="market.status === 'resolved'"
            severity="success"
            class="inline-message"
            data-testid="resolved-notice"
          >
            {{ t('resolve.resolvedNotice', { outcome: winnerName ?? '' }) }}
          </Message>

          <form
            v-if="canResolveNow"
            method="post"
            :action="URL"
            data-testid="resolve-form"
            @submit.prevent="resolveHandler"
          >
            <fieldset class="outcome-fieldset">
              <legend>{{ t('resolve.resolveLegend') }}</legend>
              <div v-for="outcome in market.outcomes" :key="outcome.id" class="outcome-choice">
                <RadioButton
                  v-model="outcomeId"
                  :input-id="`resolve-outcome-input-${outcome.id}`"
                  name="outcome_id"
                  :value="outcome.id"
                  :data-testid="`resolve-outcome-${outcome.id}`"
                />
                <label :for="`resolve-outcome-input-${outcome.id}`">{{ outcome.name }}</label>
              </div>
            </fieldset>
            <div class="actions">
              <Button
                type="submit"
                :label="t('resolve.resolveButton')"
                :disabled="isResolving"
                data-testid="resolve-submit"
              />
            </div>
          </form>

          <section v-if="canCorrect">
            <h3>{{ t('resolve.correctTitle') }}</h3>
            <p class="hint">{{ t('resolve.correctHint') }}</p>
            <form
              method="post"
              :action="URL"
              data-testid="correct-form"
              @submit.prevent="correctHandler"
            >
              <fieldset class="outcome-fieldset">
                <legend>{{ t('resolve.correctLegend') }}</legend>
                <div
                  v-for="outcome in correctableOutcomes"
                  :key="outcome.id"
                  class="outcome-choice"
                >
                  <RadioButton
                    v-model="outcomeId"
                    :input-id="`correct-outcome-input-${outcome.id}`"
                    name="outcome_id"
                    :value="outcome.id"
                    :data-testid="`correct-outcome-${outcome.id}`"
                  />
                  <label :for="`correct-outcome-input-${outcome.id}`">{{ outcome.name }}</label>
                </div>
              </fieldset>
              <div class="actions">
                <Button
                  type="submit"
                  :label="t('resolve.correctButton')"
                  :disabled="isCorrecting"
                  data-testid="correct-submit"
                />
              </div>
            </form>
          </section>

          <section v-if="canVoid">
            <h3>{{ t('resolve.voidTitle') }}</h3>
            <p class="hint">
              {{
                market.status === 'resolved'
                  ? t('resolve.voidHintResolved')
                  : t('resolve.voidHintOpen')
              }}
            </p>
            <Button
              type="button"
              severity="danger"
              outlined
              :label="t('resolve.voidButton')"
              :disabled="isVoiding"
              data-testid="void-button"
              @click="voidHandler"
            />
          </section>
        </sticker-card>
      </template>
    </group-shell>
  </main>
</template>

<style scoped lang="scss">
section {
  margin-bottom: var(--spacing-lg);
}

.back-nav {
  margin-bottom: var(--spacing-md);
}

.outcome-fieldset {
  padding: 0;
  margin: 0 0 var(--spacing-md);
  border: none;

  legend {
    padding: 0;
    margin-bottom: var(--spacing-xs);
    font-weight: 600;
  }
}

.outcome-choice {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  margin-bottom: var(--spacing-xs);
}
</style>
