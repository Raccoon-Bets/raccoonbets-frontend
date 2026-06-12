<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Err, Ok, type Result } from 'ts-results'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'
import config from '@/config'
import FieldErrors from '@/components/fieldErrors.vue'
import FormField from '@/components/formField.vue'
import GroupShell from '@/components/group/groupShell.vue'
import MoneyField from '@/components/moneyField.vue'
import OutcomeRow from '@/components/sticker/outcomeRow.vue'
import StickerBadge from '@/components/sticker/stickerBadge.vue'
import StickerCard from '@/components/sticker/stickerCard.vue'
import useChannel, { channelEventSchema } from '@/composables/useChannel'
import useCountdown, { type CountdownUrgency } from '@/composables/useCountdown'
import useFormErrorHandling from '@/composables/useFormErrorHandling'
import useGroupGuard from '@/composables/useGroupGuard'
import useMoney from '@/composables/useMoney'
import { global } from '@/i18n'
import type { PositionJSONUp, MarketUpdateJSONUp } from '@/stores/coding'
import { useGroupStore } from '@/stores/modules/group'
import { useMarketStore } from '@/stores/modules/market'
import { groupPath } from '@/stores/modules/root'
import type { Errors } from '@/stores/types'
import { fromMinorUnits, toMinorUnits } from '@/utils/currency'
import { formatMultiplier, payoutMultiplier } from '@/utils/parimutuel'
import { marketPath } from '@/utils/marketURL'
import useCanonicalMarketURL from '@/composables/useCanonicalMarketURL'
import { errorToString, notifySentry } from '@/utils/errors'
import type { Position } from '@/types'

const { t, d } = useI18n()
const route = useRoute()
const router = useRouter()
const groupStore = useGroupStore()
const marketStore = useMarketStore()
useGroupGuard()

const marketId = computed(() => parseInt(String(route.params.marketId), 10))

// The store keeps a stale copy visible while the same market refreshes, so this
// reload is flicker-free when arriving from the create screen's seeded state.
watch(
  [() => groupStore.isMember, marketId],
  ([isMember, id]) => {
    if (isMember && Number.isInteger(id)) void marketStore.loadMarket(id)
  },
  { immediate: true },
)

// Live updates: every MarketChannel event (position_changed, market_resolved,
// market_voided, market_corrected) reloads the market; the stale copy stays
// visible during the flicker-free refresh.
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

useCanonicalMarketURL(() => market.value)

const { format } = useMoney()
const { countdown, urgency } = useCountdown(() => market.value?.locksAt ?? new Date(0))

// Normal urgency keeps the pill on brand; warning/alert escalate as lock approaches.
const LOCK_PILL_TONES: Record<CountdownUrgency, 'primary' | 'warning' | 'alert'> = {
  normal: 'primary',
  warning: 'warning',
  alert: 'alert',
}
const lockPillTone = computed(() => LOCK_PILL_TONES[urgency.value])

const outcomeNames = computed(() => {
  const names = new Map<number, string>()
  for (const outcome of market.value?.outcomes ?? []) names.set(outcome.id, outcome.name)
  return names
})
const winnerName = computed(() => {
  const id = market.value?.winningOutcomeId ?? null
  return id === null ? null : (outcomeNames.value.get(id) ?? null)
})
const openForTrading = computed(
  () => market.value !== null && market.value.status === 'open' && !market.value.locked,
)
const canResolve = computed(() => {
  const membership = groupStore.membership
  if (market.value === null || membership === null) return false
  if (market.value.status === 'voided') return false
  return membership.role === 'admin' || market.value.oracle.id === membership.id
})

// Formats a net payout with an explicit sign so wins read as gains (+$1.00).
function signedAmount(netCents: number): string {
  const formatted = format(netCents, market.value?.currency ?? 'USD')
  return netCents > 0 ? `+${formatted}` : formatted
}

function poolShare(poolCents: number): string | null {
  const total = market.value?.totalPoolCents ?? 0
  if (total === 0) return null
  return t('marketDetail.share', { percent: Math.round((poolCents / total) * 100) })
}

function multiplierFor(poolCents: number): string | null {
  const multiplier = payoutMultiplier(market.value?.totalPoolCents ?? 0, poolCents)
  return multiplier === null ? null : formatMultiplier(multiplier, global.locale.value)
}

// ── Editing (creator or admin, while open) ───────────────────────────

const isAdmin = computed(() => groupStore.membership?.role === 'admin')
const canEdit = computed(
  () =>
    market.value !== null &&
    market.value.status === 'open' &&
    (market.value.creator.id === groupStore.membership?.id || isAdmin.value),
)

const editing = ref(false)
const editForm = reactive({ title: '', description: '', locksAt: null as Date | null })

function startEditing(): void {
  const loaded = market.value
  if (loaded === null) return
  editForm.title = loaded.title
  editForm.description = loaded.description ?? ''
  editForm.locksAt = new Date(loaded.locksAt)
  editing.value = true
}

const {
  submitHandler: editHandler,
  errors: editErrors,
  error: editError,
  isProcessing: isEditing,
} = useFormErrorHandling(
  () => {
    const attributes: MarketUpdateJSONUp = {
      title: editForm.title,
      description: editForm.description,
    }
    if (editForm.locksAt !== null) attributes.locks_at = editForm.locksAt.toISOString()
    return marketStore.updateMarket(attributes)
  },
  () => {
    editing.value = false
  },
)

// Business-rule rejections (not the creator, market no longer open) land under `base`.
const editBaseErrors = computed(() =>
  Object.entries(editErrors.value)
    .filter(([field]) => field === 'base')
    .flatMap(([, messages]) => messages),
)

// ── Order slip ──────────────────────────────────────────────────────────

const orderSlip = reactive({
  outcomeId: null as number | null,
  // The amount in decimal major units; converted to minor units on submit.
  amount: null as number | null,
})

watch(
  market,
  (loaded) => {
    if (loaded?.myPosition && orderSlip.outcomeId === null && orderSlip.amount === null) {
      orderSlip.outcomeId = loaded.myPosition.outcomeId
      orderSlip.amount = fromMinorUnits(loaded.myPosition.amountCents, loaded.currency)
    }
  },
  { immediate: true },
)

const amountBounds = computed(() => {
  const group = groupStore.group
  const currency = market.value?.currency
  if (group === null || currency === undefined) return null
  return {
    min: format(group.minAmountCents, currency),
    max: format(group.maxAmountCents, currency),
  }
})

// The multiplier the selected outcome would pay if the pending amount landed
// now. An existing position already sits inside both pools, so the preview backs
// it out before adding the pending amount — otherwise an update would count the
// user's money twice.
const selectedMultiplier = computed(() => {
  const loaded = market.value
  if (loaded === null) return null
  const outcome = loaded.outcomes.find((candidate) => candidate.id === orderSlip.outcomeId)
  if (outcome === undefined) return null

  const amount = orderSlip.amount ?? Number.NaN
  const amountCents = Number.isFinite(amount)
    ? Math.max(toMinorUnits(amount, loaded.currency), 0)
    : 0

  const existing = loaded.myPosition
  const existingOnOutcome =
    existing !== null && existing.outcomeId === outcome.id ? existing.amountCents : 0
  const totalPoolCents =
    Math.max(loaded.totalPoolCents - (existing?.amountCents ?? 0), 0) + amountCents
  const outcomePoolCents = Math.max(outcome.poolCents - existingOnOutcome, 0) + amountCents
  const multiplier = payoutMultiplier(totalPoolCents, outcomePoolCents)
  return multiplier === null ? null : formatMultiplier(multiplier, global.locale.value)
})

function validatedPosition(): Result<PositionJSONUp, Errors> {
  const group = groupStore.group
  const loaded = market.value
  if (group === null || loaded === null || orderSlip.outcomeId === null) {
    return new Err({ base: [t('error.unknown')] })
  }

  const amount = orderSlip.amount ?? Number.NaN
  const cents = Number.isFinite(amount) ? toMinorUnits(amount, loaded.currency) : Number.NaN
  if (!Number.isInteger(cents) || cents < group.minAmountCents || cents > group.maxAmountCents) {
    return new Err({
      amount_cents: [
        t('orderSlip.amountInvalid', {
          min: format(group.minAmountCents, loaded.currency),
          max: format(group.maxAmountCents, loaded.currency),
        }),
      ],
    })
  }
  return new Ok({ outcome_id: orderSlip.outcomeId, amount_cents: cents })
}

const { submitHandler, errors, error, isProcessing } = useFormErrorHandling(
  async () => {
    const position = validatedPosition()
    if (!position.ok) return position
    return marketStore.placePosition(position.val)
  },
  () => undefined,
)

const {
  submitHandler: cancelHandler,
  error: cancelError,
  isProcessing: isCancelling,
} = useFormErrorHandling(
  () => marketStore.cancelPosition(),
  () => undefined,
)

// Errors not tied to the amount field (an invalid outcome, or a market that
// locked mid-submission) render above the form.
const baseErrors = computed(() =>
  Object.entries(errors.value)
    .filter(([field]) => field === 'base' || field === 'outcome_id')
    .flatMap(([, messages]) => messages),
)

const isMyPosition = (memberId: number): boolean => memberId === groupStore.membership?.id

// ── Admin tools: delete the market, cancel members' positions ─────────

const canDelete = computed(() => isAdmin.value && market.value?.status === 'open')
const deleteError = ref<string | null>(null)
const isDeleting = ref(false)

async function deleteMarket(): Promise<void> {
  if (!window.confirm(t('marketDetail.deleteConfirm'))) return
  deleteError.value = null
  isDeleting.value = true
  try {
    const result = await marketStore.deleteMarket()
    if (result.ok) {
      await router.push({ name: 'feed' })
    } else {
      deleteError.value = Object.values(result.val).flat().join(', ')
    }
  } catch (error) {
    notifySentry(error)
    deleteError.value = errorToString(error)
  }
  isDeleting.value = false
}

const canCancelPosition = (memberId: number): boolean =>
  isAdmin.value && openForTrading.value && !isMyPosition(memberId)

const cancelPositionError = ref<string | null>(null)
const isCancellingPosition = ref(false)

async function cancelMemberPosition(position: Position): Promise<void> {
  const warning = t('marketDetail.cancelPositionConfirm', {
    name: position.member.name,
    amount: format(position.amountCents, market.value?.currency ?? 'USD'),
  })
  if (!window.confirm(warning)) return
  cancelPositionError.value = null
  isCancellingPosition.value = true
  try {
    const result = await marketStore.cancelMemberPosition(position.id)
    if (!result.ok) cancelPositionError.value = Object.values(result.val).flat().join(', ')
  } catch (error) {
    notifySentry(error)
    cancelPositionError.value = errorToString(error)
  }
  isCancellingPosition.value = false
}

const URL = config.APIURL + groupPath(`/markets/${String(marketId.value)}/position`)
const editURL = config.APIURL + groupPath(`/markets/${String(marketId.value)}`)
</script>

<template>
  <main id="main-content" class="group-view">
    <group-shell>
      <nav class="back-nav">
        <router-link :to="{ name: 'feed' }">{{ t('marketDetail.backLink') }}</router-link>
      </nav>

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
        <sticker-card class="detail-section">
          <sticker-badge v-if="openForTrading" :tone="lockPillTone" overlap>
            {{ t('market.locksIn', { countdown }) }}
          </sticker-badge>

          <h2 class="market-title" data-testid="market-detail-title">{{ market.title }}</h2>
          <p v-if="market.description" class="description">{{ market.description }}</p>
          <p class="meta">
            <span>{{ t('marketDetail.createdBy', { name: market.creator.name }) }}</span>
            <span>{{ t('marketDetail.oracle', { name: market.oracle.name }) }}</span>
          </p>
          <p v-if="openForTrading" class="meta">
            {{ t('marketDetail.locksAt', { date: d(market.locksAt, 'long'), countdown }) }}
          </p>

          <p v-if="market.status === 'open' && market.locked" class="status-line">
            <sticker-badge tone="negative" :tilt="0" data-testid="market-locked">
              {{ t('marketDetail.lockedNotice', { name: market.oracle.name }) }}
            </sticker-badge>
          </p>
          <p v-if="market.status === 'resolved'" class="status-line">
            <sticker-badge tone="positive" :tilt="0" data-testid="market-resolved">
              {{
                winnerName === null
                  ? t('marketDetail.resolvedNotice')
                  : t('marketDetail.resolvedWinnerNotice', { name: winnerName })
              }}
            </sticker-badge>
          </p>
          <p v-if="market.status === 'voided'" class="status-line">
            <sticker-badge tone="muted" :tilt="0" data-testid="market-voided">
              {{ t('marketDetail.voidedNotice') }}
            </sticker-badge>
          </p>

          <p v-if="canResolve">
            <router-link
              :to="{ name: 'marketResolve', params: { marketId: marketPath(market) } }"
              data-testid="resolve-link"
            >
              {{ t('marketDetail.resolveLink') }}
            </router-link>
          </p>

          <p v-if="canEdit && !editing">
            <Button
              type="button"
              severity="secondary"
              size="small"
              :label="t('marketDetail.editLink')"
              data-testid="market-edit-toggle"
              @click="startEditing"
            />
          </p>

          <section v-if="canEdit && editing" class="edit-form" data-testid="market-edit-form">
            <h2 class="section-head">{{ t('marketDetail.editTitle') }}</h2>

            <Message
              v-if="editError"
              severity="error"
              class="inline-message"
              data-testid="market-edit-error"
            >
              {{ t('marketDetail.editError', { error: editError }) }}
            </Message>
            <field-errors field="base" :messages="editBaseErrors" />

            <form method="post" :action="editURL" @submit.prevent="editHandler">
              <form-field
                v-model="editForm.title"
                type="text"
                object="market"
                field="title"
                :errors="editErrors"
                :label="t('marketsNew.titleLabel')"
                required
                maxlength="200"
                data-testid="market-edit-title"
              />

              <div class="form-field">
                <label for="market-edit-description">{{ t('marketsNew.descriptionLabel') }}</label>
                <Textarea
                  id="market-edit-description"
                  v-model="editForm.description"
                  name="market[description]"
                  rows="4"
                  fluid
                  :invalid="(editErrors.description?.length ?? 0) > 0"
                  data-testid="market-edit-description"
                />
                <field-errors field="description" :messages="editErrors.description ?? []" />
              </div>

              <div class="form-field">
                <label for="market-edit-locks_at">{{ t('marketsNew.locksAtLabel') }}</label>
                <DatePicker
                  v-model="editForm.locksAt"
                  input-id="market-edit-locks_at"
                  show-time
                  hour-format="12"
                  date-format="yy-mm-dd"
                  required
                  fluid
                  :invalid="(editErrors.locks_at?.length ?? 0) > 0"
                  :pt="{ pcInputText: { root: { 'data-testid': 'market-edit-locks-at' } } }"
                />
                <field-errors field="locks_at" :messages="editErrors.locks_at ?? []" />
              </div>
              <div class="actions">
                <Button
                  type="submit"
                  :label="t('marketDetail.editButton')"
                  :disabled="isEditing"
                  data-testid="market-edit-submit"
                />
                <Button
                  type="button"
                  severity="secondary"
                  :label="t('marketDetail.editCancel')"
                  :disabled="isEditing"
                  data-testid="market-edit-cancel"
                  @click="editing = false"
                />
              </div>
            </form>
          </section>

          <Message
            v-if="deleteError"
            severity="error"
            class="inline-message"
            data-testid="market-delete-error"
          >
            {{ t('marketDetail.deleteError', { error: deleteError }) }}
          </Message>
          <p v-if="canDelete && !editing">
            <Button
              type="button"
              severity="danger"
              outlined
              size="small"
              :label="t('marketDetail.deleteLink')"
              :disabled="isDeleting"
              data-testid="market-delete"
              @click="deleteMarket"
            />
          </p>
        </sticker-card>

        <sticker-card class="detail-section">
          <h2 class="section-head">{{ t('marketDetail.outcomesTitle') }}</h2>
          <p class="meta">
            {{ t('market.totalPool', { amount: format(market.totalPoolCents, market.currency) }) }}
          </p>
          <ul class="outcomes">
            <li
              v-for="outcome in market.outcomes"
              :key="outcome.id"
              :class="{ winner: outcome.id === market.winningOutcomeId }"
              :data-testid="`outcome-${outcome.id}`"
            >
              <span class="name">{{ outcome.name }}</span>
              <span>{{ format(outcome.poolCents, market.currency) }}</span>
              <span v-if="poolShare(outcome.poolCents) !== null">
                {{ poolShare(outcome.poolCents) }}
              </span>
              <small>{{ t('market.positionCount', outcome.positionCount) }}</small>
            </li>
          </ul>
        </sticker-card>

        <sticker-card v-if="openForTrading" class="detail-section" data-testid="order-slip">
          <h2 class="section-head">
            {{ market.myPosition ? t('orderSlip.updateTitle') : t('orderSlip.placeTitle') }}
          </h2>

          <Message
            v-if="error"
            severity="error"
            class="inline-message"
            data-testid="position-error"
          >
            {{ t('orderSlip.error', { error }) }}
          </Message>
          <field-errors field="base" :messages="baseErrors" />

          <form method="post" :action="URL" @submit.prevent="submitHandler">
            <div
              role="radiogroup"
              class="outcome-rows"
              :aria-label="
                market.myPosition ? t('orderSlip.updateTitle') : t('orderSlip.placeTitle')
              "
            >
              <outcome-row
                v-for="(outcome, index) in market.outcomes"
                :key="outcome.id"
                interactive
                name="position-outcome"
                :label="outcome.name"
                :amount="format(outcome.poolCents, market.currency)"
                :multiplier="multiplierFor(outcome.poolCents)"
                :index="index"
                :selected="orderSlip.outcomeId === outcome.id"
                :data-testid="`position-outcome-${outcome.id}`"
                @select="orderSlip.outcomeId = outcome.id"
              />
            </div>

            <money-field
              v-model="orderSlip.amount"
              :currency="market.currency"
              input-id="position-amount_cents"
              field="amount_cents"
              :label="t('orderSlip.amountLabel')"
              :errors="errors"
              testid="position-amount"
            />
            <p v-if="amountBounds !== null" class="hint" data-testid="position-amount-range">
              {{ t('orderSlip.amountRange', amountBounds) }}
            </p>
            <p
              v-if="selectedMultiplier"
              class="payout-preview"
              data-testid="position-payout-preview"
            >
              {{ t('orderSlip.paysPreview', { multiplier: selectedMultiplier }) }}
            </p>

            <div class="actions">
              <Button
                type="submit"
                :label="
                  market.myPosition ? t('orderSlip.updateButton') : t('orderSlip.placeButton')
                "
                :disabled="isProcessing"
                data-testid="position-submit"
              />
            </div>
          </form>

          <Message
            v-if="cancelError"
            severity="error"
            class="inline-message"
            data-testid="position-cancel-error"
          >
            {{ t('orderSlip.cancelError', { error: cancelError }) }}
          </Message>
          <Button
            v-if="market.myPosition"
            type="button"
            severity="danger"
            outlined
            :label="t('orderSlip.cancelButton')"
            :disabled="isCancelling"
            data-testid="position-cancel"
            @click="cancelHandler"
          />
        </sticker-card>

        <sticker-card
          v-if="market.status === 'resolved' && market.payouts.length > 0"
          class="detail-section"
        >
          <h2 class="section-head">{{ t('marketDetail.payoutsTitle') }}</h2>
          <ul class="payouts" data-testid="payouts">
            <li
              v-for="payout in market.payouts"
              :key="payout.membershipId"
              :class="payout.netCents >= 0 ? 'win' : 'loss'"
              :data-testid="`payout-${payout.membershipId}`"
            >
              <span class="name">{{ payout.name }}</span>
              <span class="net">{{ signedAmount(payout.netCents) }}</span>
            </li>
          </ul>
        </sticker-card>

        <sticker-card v-if="market.events.length > 0" class="detail-section">
          <h2 class="section-head">{{ t('marketDetail.eventsTitle') }}</h2>
          <ul class="events" data-testid="market-events">
            <li v-for="(event, index) in market.events" :key="index">
              <span>
                {{
                  t(`marketDetail.event.${event.action}`, {
                    actor: event.actorName,
                    outcome: event.outcomeName ?? '',
                  })
                }}
              </span>
              <small>{{ d(event.createdAt, 'long') }}</small>
            </li>
          </ul>
        </sticker-card>

        <sticker-card class="detail-section">
          <h2 class="section-head">{{ t('marketDetail.positionsTitle') }}</h2>
          <Message
            v-if="cancelPositionError"
            severity="error"
            class="inline-message"
            data-testid="position-admin-cancel-error"
          >
            {{ t('marketDetail.cancelPositionError', { error: cancelPositionError }) }}
          </Message>
          <p v-if="market.positions.length === 0" data-testid="positions-empty">
            {{ t('marketDetail.positionsEmpty') }}
          </p>
          <ul class="positions">
            <li
              v-for="position in market.positions"
              :key="position.id"
              :data-testid="`position-${position.id}`"
            >
              <span class="name">{{ position.member.name }}</span>
              <span>{{ outcomeNames.get(position.outcomeId) }}</span>
              <span>{{ format(position.amountCents, market.currency) }}</span>
              <small v-if="isMyPosition(position.member.id)">{{
                t('marketDetail.myPositionTag')
              }}</small>
              <Button
                v-if="canCancelPosition(position.member.id)"
                type="button"
                size="small"
                severity="danger"
                outlined
                :label="t('marketDetail.cancelPositionButton')"
                :disabled="isCancellingPosition"
                :data-testid="`position-${position.id}-admin-cancel`"
                @click="cancelMemberPosition(position)"
              />
            </li>
          </ul>
        </sticker-card>
      </template>
    </group-shell>
  </main>
</template>

<style scoped lang="scss">
.back-nav {
  margin-bottom: var(--spacing-md);
}

.market-title {
  margin: 0 0 var(--spacing-xs);
}

.description {
  white-space: pre-wrap;
}

.meta {
  display: flex;
  gap: var(--spacing-md);
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.status-line {
  margin: var(--spacing-md) 0;
}

ul.payouts,
ul.events,
ul.outcomes,
ul.positions {
  padding: 0;
  margin: 0;
  list-style: none;

  li {
    display: flex;
    gap: var(--spacing-md);
    padding: var(--spacing-xs) 0;
    border-bottom: 1px solid var(--p-content-border-color);

    .name {
      flex: 1;
      font-weight: 600;
    }

    &.winner {
      color: var(--p-green-600);
    }

    &.win .net {
      color: var(--p-green-600);
    }

    &.loss .net {
      color: var(--p-red-500);
    }
  }
}

.outcome-rows {
  margin-bottom: var(--spacing-md);
}

.payout-preview {
  font-family: var(--rb-font-display);
  font-weight: 800;
}
</style>
