<script setup lang="ts">
import { computed, ref } from 'vue'
import type { InputHTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'
import { browserSupportsWebAuthn } from '@simplewebauthn/browser'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Password from 'primevue/password'
import type { Passkey } from '@/types'
import { useAccountStore } from '@/stores/modules/account'
import { usePasskeysStore } from '@/stores/modules/passkeys'
import { errorToString } from '@/utils/errors'

const { t, d } = useI18n()
const accountStore = useAccountStore()
const passkeysStore = usePasskeysStore()

const newLabel = ref('')
const newPassword = ref('')
const renameId = ref<string | null>(null)
const renameLabel = ref('')
const error = ref<string | null>(null)
const success = ref<string | null>(null)

const supported = browserSupportsWebAuthn()

// Typed so the testid (not part of InputHTMLAttributes) reaches the inner input.
const newPasswordInputProps = {
  'data-testid': 'passkey-new-password',
  autocomplete: 'current-password',
} as InputHTMLAttributes
const passkeys = computed<Passkey[]>(() => accountStore.currentUser?.passkeys ?? [])

function clearMessages(): void {
  error.value = null
  success.value = null
}

async function addPasskey(): Promise<void> {
  clearMessages()
  if (!newPassword.value) {
    error.value = t('account.passkeys.passwordRequired')
    return
  }
  try {
    const result = await passkeysStore.register(
      newPassword.value,
      newLabel.value.trim() || undefined,
    )
    if (result.ok) {
      success.value = t('account.passkeys.registered')
      newLabel.value = ''
      newPassword.value = ''
    } else {
      const errs = Object.values(result.val).flat().join(', ')
      error.value = errs || t('account.passkeys.registerError')
    }
  } catch (err) {
    error.value = errorToString(err)
  }
}

function startRename(passkey: Passkey): void {
  clearMessages()
  renameId.value = passkey.id
  renameLabel.value = passkey.label ?? ''
}

async function saveRename(): Promise<void> {
  clearMessages()
  if (!renameId.value) return
  try {
    const result = await passkeysStore.rename(renameId.value, renameLabel.value.trim())
    if (result.ok) {
      success.value = t('account.passkeys.renamed')
      renameId.value = null
      renameLabel.value = ''
    } else {
      error.value = t('account.passkeys.renameError')
    }
  } catch (err) {
    error.value = errorToString(err)
  }
}

function cancelRename(): void {
  renameId.value = null
  renameLabel.value = ''
}

async function remove(passkey: Passkey): Promise<void> {
  clearMessages()
  if (!window.confirm(t('account.passkeys.confirmRemove'))) return
  try {
    await passkeysStore.remove(passkey.id)
    success.value = t('account.passkeys.removed')
  } catch (err) {
    error.value = errorToString(err)
  }
}

function formatLastUsed(passkey: Passkey): string {
  if (!passkey.lastUsedAt) return t('account.passkeys.neverUsed')
  return t('account.passkeys.lastUsed', { date: d(passkey.lastUsedAt, 'long') })
}
</script>

<template>
  <section data-testid="passkeys-section">
    <h2>{{ t('account.passkeys.title') }}</h2>

    <p v-if="!supported">
      {{ t('account.passkeys.unsupported') }}
    </p>

    <template v-else>
      <p v-if="passkeys.length === 0">
        {{ t('account.passkeys.empty') }}
      </p>

      <ul v-else>
        <li v-for="passkey in passkeys" :key="passkey.id">
          <template v-if="renameId === passkey.id">
            <InputText
              v-model="renameLabel"
              type="text"
              :placeholder="t('account.passkeys.labelPlaceholder')"
              data-testid="passkey-rename-input"
              @keyup.enter="saveRename"
              @keydown.escape="cancelRename"
            />
            <Button
              type="button"
              size="small"
              :label="t('account.passkeys.save')"
              data-testid="passkey-rename-save"
              @click="saveRename"
            />
            <Button
              type="button"
              size="small"
              severity="secondary"
              :label="t('account.passkeys.cancel')"
              @click="cancelRename"
            />
          </template>

          <template v-else>
            <span data-testid="passkey-label">
              {{ passkey.label || t('account.passkeys.unnamed') }}
            </span>
            <small>{{ formatLastUsed(passkey) }}</small>
            <Button
              type="button"
              size="small"
              severity="secondary"
              :label="t('account.passkeys.rename')"
              data-testid="passkey-rename"
              @click="startRename(passkey)"
            />
            <Button
              type="button"
              size="small"
              severity="danger"
              outlined
              :label="t('account.passkeys.remove')"
              data-testid="passkey-remove"
              @click="remove(passkey)"
            />
          </template>
        </li>
      </ul>

      <div class="add-passkey">
        <InputText
          v-model="newLabel"
          type="text"
          :placeholder="t('account.passkeys.labelPlaceholder')"
          data-testid="passkey-new-label"
          :disabled="passkeysStore.registering"
        />
        <Password
          v-model="newPassword"
          :feedback="false"
          toggle-mask
          fluid
          :placeholder="t('account.passkeys.passwordPlaceholder')"
          :disabled="passkeysStore.registering"
          :input-props="newPasswordInputProps"
        />
        <Button
          type="button"
          :label="t('account.passkeys.add')"
          data-testid="passkey-add"
          :disabled="passkeysStore.registering"
          @click="addPasskey"
        />
      </div>
    </template>

    <Message v-if="error" severity="error" class="inline-message" data-testid="passkeys-error">
      {{ error }}
    </Message>
    <Message
      v-if="success"
      severity="success"
      class="inline-message"
      data-testid="passkeys-success"
    >
      {{ success }}
    </Message>
  </section>
</template>

<style scoped lang="scss">
ul {
  padding: 0;
  list-style: none;
}

li {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  align-items: center;
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--p-content-border-color);

  span {
    font-weight: 600;
  }
}

.add-passkey {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin: var(--spacing-md) 0;
}
</style>
