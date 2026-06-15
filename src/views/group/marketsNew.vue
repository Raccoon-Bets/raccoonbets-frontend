<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import config from '@/config'
import FieldErrors from '@/components/fieldErrors.vue'
import FormField from '@/components/formField.vue'
import GroupShell from '@/components/group/groupShell.vue'
import StickerCard from '@/components/sticker/stickerCard.vue'
import useFormErrorHandling from '@/composables/useFormErrorHandling'
import useGroupGuard from '@/composables/useGroupGuard'
import type { MarketJSONUp } from '@/stores/coding'
import { useGroupStore } from '@/stores/modules/group'
import { useMembersStore } from '@/stores/modules/members'
import { useMarketStore } from '@/stores/modules/market'
import { useMarketsStore } from '@/stores/modules/markets'
import { marketPath } from '@/utils/marketURL'
import { groupPath } from '@/stores/modules/root'

const { t } = useI18n()
const router = useRouter()
const groupStore = useGroupStore()
const membersStore = useMembersStore()
const marketStore = useMarketStore()
const marketsStore = useMarketsStore()
useGroupGuard()

const form = reactive<{
  title: string
  description: string
  kind: 'scheduled' | 'open_ended'
  locksAt: Date | null
  outcomes: string[]
  oracleId: number | null
}>({
  title: '',
  description: '',
  kind: 'scheduled',
  // A local-time Date from the picker; converted to ISO 8601 on submit.
  locksAt: null,
  outcomes: ['YES', 'NO'],
  oracleId: null,
})

const kindOptions = computed(() => [
  { value: 'scheduled', label: t('marketsNew.kindScheduled') },
  { value: 'open_ended', label: t('marketsNew.kindOpenEnded') },
])

watch(
  () => groupStore.isMember,
  (isMember) => {
    if (!isMember) return
    form.oracleId ??= groupStore.membership?.id ?? null
    void membersStore.loadMembers()
  },
  { immediate: true },
)

function addOutcome(): void {
  form.outcomes.push('')
}

function removeOutcome(index: number): void {
  if (form.outcomes.length > 2) form.outcomes.splice(index, 1)
}

function payload(): MarketJSONUp {
  const attributes: MarketJSONUp = {
    title: form.title,
    description: form.description,
    kind: form.kind,
    outcomes: form.outcomes.map((name) => name.trim()).filter((name) => name !== ''),
  }
  if (form.kind === 'scheduled') {
    attributes.locks_at = form.locksAt === null ? '' : form.locksAt.toISOString()
  }
  if (form.oracleId !== null) attributes.oracle_id = form.oracleId
  return attributes
}

const { submitHandler, errors, error, isProcessing } = useFormErrorHandling(
  () => marketsStore.createMarket(payload()),
  async (created) => {
    marketStore.setMarket(created)
    await router.push({ name: 'marketDetail', params: { marketId: marketPath(created) } })
  },
)

const errorMessage = computed<string | null>(() =>
  error.value === null ? null : t('marketsNew.error', { error: error.value }),
)

const URL = config.APIURL + groupPath('/markets')
</script>

<template>
  <main id="main-content" class="group-view">
    <group-shell>
      <h2>{{ t('marketsNew.title') }}</h2>

      <sticker-card>
        <Message v-if="error" severity="error" class="inline-message" data-testid="market-error">
          {{ errorMessage }}
        </Message>

        <form method="post" :action="URL" @submit.prevent="submitHandler">
          <form-field
            v-model="form.title"
            type="text"
            object="market"
            field="title"
            :errors="errors"
            :label="t('marketsNew.titleLabel')"
            required
            maxlength="200"
            data-testid="market-title"
          />

          <div class="form-field">
            <label for="market-description">{{ t('marketsNew.descriptionLabel') }}</label>
            <Textarea
              id="market-description"
              v-model="form.description"
              name="market[description]"
              rows="4"
              fluid
              :invalid="(errors.description?.length ?? 0) > 0"
              data-testid="market-description"
            />
            <field-errors field="description" :messages="errors.description ?? []" />
          </div>
          <p class="hint">{{ t('marketsNew.descriptionHint') }}</p>

          <div class="form-field">
            <label for="market-kind">{{ t('marketsNew.kindLabel') }}</label>
            <Select
              v-model="form.kind"
              input-id="market-kind"
              :options="kindOptions"
              option-label="label"
              option-value="value"
              fluid
              data-testid="market-kind"
            />
          </div>
          <p class="hint">{{ t('marketsNew.kindHint') }}</p>

          <div v-if="form.kind === 'scheduled'" class="form-field">
            <label for="market-locks_at">{{ t('marketsNew.locksAtLabel') }}</label>
            <DatePicker
              v-model="form.locksAt"
              input-id="market-locks_at"
              show-time
              hour-format="12"
              date-format="yy-mm-dd"
              required
              fluid
              :invalid="(errors.locks_at?.length ?? 0) > 0"
              :pt="{ pcInputText: { root: { 'data-testid': 'market-locks-at' } } }"
            />
            <field-errors field="locks_at" :messages="errors.locks_at ?? []" />
          </div>

          <fieldset class="outcomes-fieldset">
            <legend>{{ t('marketsNew.outcomesLegend') }}</legend>
            <div v-for="(_, index) in form.outcomes" :key="index" class="outcome-row">
              <label :for="`market-outcome-${index}`" class="hint">
                {{ t('marketsNew.outcomeLabel', { number: index + 1 }) }}
              </label>
              <div class="outcome-input">
                <InputText
                  :id="`market-outcome-${index}`"
                  v-model="form.outcomes[index]"
                  type="text"
                  :name="`market[outcomes][${index}]`"
                  required
                  fluid
                  :data-testid="`market-outcome-${index}`"
                />
                <Button
                  v-if="form.outcomes.length > 2"
                  type="button"
                  severity="danger"
                  outlined
                  icon="pi pi-times"
                  :aria-label="t('marketsNew.removeOutcome', { number: index + 1 })"
                  @click="removeOutcome(index)"
                />
              </div>
            </div>
            <Button
              type="button"
              severity="secondary"
              size="small"
              :label="t('marketsNew.addOutcome')"
              data-testid="market-add-outcome"
              @click="addOutcome"
            />
            <field-errors field="outcomes" :messages="errors.outcomes ?? []" />
          </fieldset>

          <div class="form-field">
            <label for="market-oracle">{{ t('marketsNew.oracleLabel') }}</label>
            <Select
              v-model="form.oracleId"
              input-id="market-oracle"
              :options="membersStore.members ?? []"
              option-label="user.name"
              option-value="id"
              fluid
              :invalid="(errors.oracle?.length ?? 0) > 0"
              data-testid="market-oracle"
            />
            <field-errors field="oracle" :messages="errors.oracle ?? []" />
          </div>
          <p class="hint">{{ t('marketsNew.oracleHint') }}</p>

          <div class="actions">
            <Button
              type="submit"
              :label="t('marketsNew.button')"
              :disabled="isProcessing"
              data-testid="market-submit"
            />
          </div>
        </form>
      </sticker-card>
    </group-shell>
  </main>
</template>

<style scoped lang="scss">
.outcomes-fieldset {
  padding: 0;
  margin: 0 0 var(--spacing-md);
  border: none;

  legend {
    padding: 0;
    margin-bottom: var(--spacing-xs);
    font-weight: 600;
  }
}

.outcome-row {
  margin-bottom: var(--spacing-sm);

  label {
    display: block;
    margin-bottom: var(--spacing-xs);
  }
}

.outcome-input {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}
</style>
