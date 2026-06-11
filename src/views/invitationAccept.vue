<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import Message from 'primevue/message'
import requireAuth from '@/composables/requireAuth'
import type { InvitationPreview } from '@/types'
import { useAuthStore } from '@/stores/modules/auth'
import { useInvitationsStore } from '@/stores/modules/invitations'
import { errorToString, notifySentry } from '@/utils/errors'
import AuthCard from '@/components/authCard.vue'
import groupURL from '@/utils/groupURL'

const { t } = useI18n()
const route = useRoute()
const authStore = useAuthStore()
const invitationsStore = useInvitationsStore()
requireAuth()

const token = String(route.params.token)

const preview = ref<InvitationPreview | null>(null)
const loading = ref(true)
const invalid = ref(false)
const accepting = ref(false)
const error = ref<string | null>(null)

async function loadPreview(): Promise<void> {
  loading.value = true
  try {
    const loaded = await invitationsStore.loadPreview(token)
    if (!loaded?.valid) invalid.value = true
    else preview.value = loaded
  } catch (err) {
    notifySentry(err)
    error.value = errorToString(err)
  }
  loading.value = false
}

onMounted(() => {
  // The preview endpoint requires authentication; requireAuth redirects
  // logged-out visitors, so only load once a session is present.
  watch(
    () => authStore.loggedIn,
    (isLoggedIn) => {
      if (isLoggedIn) void loadPreview()
    },
    { immediate: true },
  )
})

async function accept(): Promise<void> {
  accepting.value = true
  error.value = null
  try {
    const group = await invitationsStore.accept(token)
    if (group === null) {
      invalid.value = true
      preview.value = null
    } else {
      // A full page load on the group's subdomain boots the group app with
      // the now-active membership.
      window.location.assign(groupURL(group.subdomain))
      return
    }
  } catch (err) {
    notifySentry(err)
    error.value = errorToString(err)
  }
  accepting.value = false
}
</script>

<template>
  <main id="main-content" class="auth-view">
    <auth-card>
      <h1>{{ t('invitationAccept.title') }}</h1>

      <p v-if="loading">{{ t('messages.loading') }}</p>

      <Message v-if="error" severity="error" class="inline-message" data-testid="invitation-error">
        {{ t('invitationAccept.error', { error }) }}
      </Message>

      <p v-if="invalid" data-testid="invitation-invalid">
        {{ t('invitationAccept.invalid') }}
      </p>

      <template v-if="preview !== null">
        <p data-testid="invitation-preview">
          {{
            t('invitationAccept.summary', {
              inviter: preview.inviterName,
              group: preview.groupName,
            })
          }}
        </p>
        <Button
          type="button"
          :label="t('invitationAccept.acceptButton', { group: preview.groupName })"
          :disabled="accepting"
          data-testid="invitation-accept"
          @click="accept"
        />
      </template>
    </auth-card>
  </main>
</template>
