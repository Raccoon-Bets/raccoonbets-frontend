<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import { groupSlug } from '@/config/tenant'
import GroupShell from '@/components/group/groupShell.vue'
import RaccoonMascot from '@/components/mascot/raccoonMascot.vue'
import StickerBadge from '@/components/sticker/stickerBadge.vue'
import StickerCard from '@/components/sticker/stickerCard.vue'
import useChannel, { channelEventSchema } from '@/composables/useChannel'
import useGroupGuard from '@/composables/useGroupGuard'
import useMoney from '@/composables/useMoney'
import { useGroupStore } from '@/stores/modules/group'
import { useSettlementStore } from '@/stores/modules/settlement'
import type { Errors } from '@/stores/types'
import { errorToString, notifySentry } from '@/utils/errors'
import { paymentLinks, type PaymentLink } from '@/utils/paymentLinks'
import type { PaymentMethod, Settlement, SettleUpTransfer } from '@/types'
import type { Result } from 'ts-results'

const { t, d } = useI18n()
const groupStore = useGroupStore()
const settlementStore = useSettlementStore()
const { format } = useMoney()
useGroupGuard()

watch(
  () => groupStore.isMember,
  (isMember) => {
    if (isMember) void settlementStore.refresh()
  },
  { immediate: true },
)

// Live updates: settlements and resolutions (and their reversals) all move
// balances, so any of them refreshes the whole settle-up picture.
const BALANCE_EVENTS = new Set([
  'settlement_recorded',
  'settlement_voided',
  'market_resolved',
  'market_voided',
  'market_corrected',
])
useChannel({
  channel: 'GroupChannel',
  params: () => (groupStore.isMember && groupSlug !== null ? { group: groupSlug } : null),
  schema: channelEventSchema,
  received: (event) => {
    if (BALANCE_EVENTS.has(event.type)) void settlementStore.refresh()
  },
})

const currency = computed(() => groupStore.group?.currency ?? 'USD')
const isAdmin = computed(() => groupStore.membership?.role === 'admin')
const myMembershipId = computed(() => groupStore.membership?.id ?? null)

const memberNames = computed(() => {
  const names = new Map<number, string>()
  for (const balance of settlementStore.balances ?? []) {
    names.set(balance.membershipId, balance.name)
  }
  return names
})

// ── Suggested transfers ───────────────────────────────────────────────

const amIPayer = (transfer: SettleUpTransfer): boolean =>
  transfer.payerMembershipId === myMembershipId.value

const canSettle = (transfer: SettleUpTransfer): boolean =>
  isAdmin.value || amIPayer(transfer) || transfer.payeeMembershipId === myMembershipId.value

function linksFor(transfer: SettleUpTransfer): PaymentLink[] {
  return paymentLinks(
    transfer.payee,
    transfer.amountCents,
    currency.value,
    settlementStore.settleUpNote ?? '',
  )
}

// Each transfer row gets its own method choice, defaulting to the first
// available payment link's method (or "other" when there are none).
const methodChoices = reactive(new Map<string, PaymentMethod>())

const transferKey = (transfer: SettleUpTransfer): string =>
  `${String(transfer.payerMembershipId)}-${String(transfer.payeeMembershipId)}`

function methodFor(transfer: SettleUpTransfer): PaymentMethod {
  return methodChoices.get(transferKey(transfer)) ?? linksFor(transfer).at(0)?.method ?? 'other'
}

function setMethod(transfer: SettleUpTransfer, method: PaymentMethod): void {
  methodChoices.set(transferKey(transfer), method)
}

const actionError = ref<string | null>(null)
const isSettling = ref(false)

async function performAction(action: () => Promise<Result<void, Errors>>): Promise<void> {
  actionError.value = null
  isSettling.value = true
  try {
    const result = await action()
    if (!result.ok) actionError.value = Object.values(result.val).flat().join(', ')
  } catch (error) {
    notifySentry(error)
    actionError.value = errorToString(error)
  }
  isSettling.value = false
}

const markSettled = (transfer: SettleUpTransfer) =>
  performAction(() =>
    settlementStore.recordSettlement({
      payer_membership_id: transfer.payerMembershipId,
      payee_membership_id: transfer.payeeMembershipId,
      amount_cents: transfer.amountCents,
      payment_method: methodFor(transfer),
      note: settlementStore.settleUpNote ?? undefined,
    }),
  )

// ── Settlement history ────────────────────────────────────────────────

const canVoid = (settlement: Settlement): boolean =>
  !settlement.voided &&
  (isAdmin.value ||
    settlement.payer.id === myMembershipId.value ||
    settlement.payee.id === myMembershipId.value)

async function voidSettlement(settlement: Settlement): Promise<void> {
  if (!window.confirm(t('settleUp.voidConfirm'))) return
  await performAction(() => settlementStore.voidSettlement(settlement.id))
}

const METHODS: PaymentMethod[] = ['venmo', 'paypal', 'cashapp', 'cash', 'other']
const METHOD_OPTIONS = computed(() =>
  METHODS.map((method) => ({ label: t(`settleUp.method.${method}`), value: method })),
)
</script>

<template>
  <main id="main-content" class="group-view">
    <group-shell>
      <div class="ledger-hero">
        <raccoon-mascot pose="ledger" :size="84" />
        <h2>{{ t('settleUp.title') }}</h2>
      </div>

      <Message
        v-if="actionError"
        severity="error"
        class="inline-message"
        data-testid="settle-up-error"
      >
        {{ t('settleUp.recordError', { error: actionError }) }}
      </Message>

      <sticker-card class="detail-section">
        <h2 class="section-head">{{ t('settleUp.balancesTitle') }}</h2>
        <Message v-if="settlementStore.balancesError" severity="error" class="inline-message">
          {{ t('settleUp.balancesError', { error: settlementStore.balancesError.message }) }}
        </Message>
        <p v-if="settlementStore.balancesLoading">{{ t('messages.loading') }}</p>
        <DataTable
          v-if="settlementStore.balances !== null"
          :value="settlementStore.balances"
          data-testid="balances"
        >
          <Column :header="t('settleUp.columns.member')">
            <template #body="{ data }">
              <span class="name" :data-testid="`balance-${data.membershipId}`">
                {{ data.name }}
              </span>
            </template>
          </Column>
          <Column :header="t('settleUp.columns.balance')">
            <template #body="{ data }">
              <sticker-badge :tilt="0" :tone="data.balanceCents >= 0 ? 'positive' : 'negative'">
                {{ format(data.balanceCents, currency) }}
              </sticker-badge>
            </template>
          </Column>
        </DataTable>
      </sticker-card>

      <sticker-card class="detail-section">
        <h2 class="section-head">{{ t('settleUp.transfersTitle') }}</h2>
        <Message v-if="settlementStore.transfersError" severity="error" class="inline-message">
          {{ t('settleUp.transfersError', { error: settlementStore.transfersError.message }) }}
        </Message>
        <p v-if="settlementStore.transfersLoading">{{ t('messages.loading') }}</p>
        <p
          v-if="settlementStore.transfers !== null && settlementStore.transfers.length === 0"
          data-testid="transfers-empty"
        >
          {{ t('settleUp.transfersEmpty') }}
        </p>
        <ul v-if="settlementStore.transfers !== null" class="transfers" data-testid="transfers">
          <li
            v-for="transfer in settlementStore.transfers"
            :key="transferKey(transfer)"
            :data-testid="`transfer-${transferKey(transfer)}`"
          >
            <p class="line">
              <span class="name">
                {{
                  t('settleUp.transferLine', {
                    payer: memberNames.get(transfer.payerMembershipId) ?? '',
                    payee: transfer.payee.name,
                  })
                }}
              </span>
              <span class="amount">{{ format(transfer.amountCents, currency) }}</span>
            </p>

            <p v-if="amIPayer(transfer) && linksFor(transfer).length > 0" class="links">
              <span>{{ t('settleUp.youAreThePayer') }}</span>
              <a
                v-for="link in linksFor(transfer)"
                :key="link.method"
                :href="link.href"
                target="_blank"
                rel="noopener noreferrer"
                class="sticker-link-button"
                :data-testid="`pay-${link.method}`"
              >
                {{ t(`settleUp.payWith.${link.method}`) }}
              </a>
            </p>

            <div v-if="canSettle(transfer)" class="settle">
              <label :for="`settle-method-${transferKey(transfer)}`">
                {{ t('settleUp.methodLabel') }}
              </label>
              <Select
                :model-value="methodFor(transfer)"
                :input-id="`settle-method-${transferKey(transfer)}`"
                :options="METHOD_OPTIONS"
                option-label="label"
                option-value="value"
                size="small"
                data-testid="settle-method"
                @update:model-value="setMethod(transfer, $event)"
              />
              <Button
                type="button"
                size="small"
                :label="t('settleUp.markSettled')"
                :disabled="isSettling"
                data-testid="mark-settled"
                @click="markSettled(transfer)"
              />
            </div>
          </li>
        </ul>
      </sticker-card>

      <sticker-card class="detail-section">
        <h2 class="section-head">{{ t('settleUp.historyTitle') }}</h2>
        <Message v-if="settlementStore.settlementsError" severity="error" class="inline-message">
          {{ t('settleUp.historyError', { error: settlementStore.settlementsError.message }) }}
        </Message>
        <p v-if="settlementStore.settlementsLoading">{{ t('messages.loading') }}</p>
        <p
          v-if="settlementStore.settlements !== null && settlementStore.settlements.length === 0"
          data-testid="history-empty"
        >
          {{ t('settleUp.historyEmpty') }}
        </p>
        <DataTable
          v-if="settlementStore.settlements !== null && settlementStore.settlements.length > 0"
          :value="settlementStore.settlements"
          data-testid="settlements"
        >
          <Column :header="t('settleUp.columns.settlement')">
            <template #body="{ data }">
              <span
                class="name"
                :class="{ voided: data.voided }"
                :data-testid="`settlement-${data.id}`"
              >
                {{ t('settleUp.historyLine', { payer: data.payer.name, payee: data.payee.name }) }}
              </span>
            </template>
          </Column>
          <Column :header="t('settleUp.columns.amount')">
            <template #body="{ data }">
              <span class="amount" :class="{ voided: data.voided }">
                {{ format(data.amountCents, data.currency) }}
              </span>
            </template>
          </Column>
          <Column :header="t('settleUp.columns.method')">
            <template #body="{ data }">
              <Tag severity="secondary" :value="t(`settleUp.method.${data.paymentMethod}`)" />
            </template>
          </Column>
          <Column :header="t('settleUp.columns.date')">
            <template #body="{ data }">
              <small>{{ d(data.createdAt, 'long') }}</small>
            </template>
          </Column>
          <Column>
            <template #body="{ data }">
              <Tag v-if="data.voided" severity="danger" :value="t('settleUp.voidedTag')" />
              <Button
                v-if="canVoid(data)"
                type="button"
                size="small"
                severity="danger"
                outlined
                :label="t('settleUp.voidButton')"
                :disabled="isSettling"
                :data-testid="`settlement-${data.id}-void`"
                @click="voidSettlement(data)"
              />
            </template>
          </Column>
        </DataTable>
      </sticker-card>
    </group-shell>
  </main>
</template>

<style scoped lang="scss">
.ledger-hero {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
}

ul.transfers {
  padding: 0;
  margin: 0;
  list-style: none;

  li {
    padding: var(--spacing-xs) 0;
    border-bottom: 1px solid var(--p-content-border-color);
  }
}

.name {
  font-weight: 600;
}

.amount {
  font-variant-numeric: tabular-nums;
}

.voided {
  text-decoration: line-through;
}

.line {
  display: flex;
  gap: var(--spacing-md);
  align-items: baseline;
  margin: 0;

  .name {
    flex: 1;
  }
}

.links,
.settle {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
  margin: var(--spacing-xs) 0;
  font-size: 0.875rem;
}

.settle label {
  font-weight: 600;
}

.sticker-link-button {
  display: inline-block;
  padding: 4px 14px;
  font-family: var(--rb-font-display);
  font-weight: 800;
  color: var(--rb-ink);
  text-decoration: none;
  background: var(--rb-surface);
  border: var(--rb-border-width-control) solid var(--rb-ink);
  border-radius: var(--rb-radius-control);
  box-shadow: var(--rb-shadow-control);
  transition:
    translate 0.12s ease,
    box-shadow 0.12s ease;

  &:active {
    translate: 3px 3px;
    box-shadow: 0 0 0 var(--rb-shadow-color);
  }

  &:focus-visible {
    outline: 3px solid var(--rb-focus-ring);
    outline-offset: 3px;
  }
}
</style>
