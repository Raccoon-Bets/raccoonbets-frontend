<script setup lang="ts">
import { computed, onMounted, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Message from 'primevue/message'
import config from '@/config'
import useFormErrorHandling from '@/composables/useFormErrorHandling'
import RaccoonMascot from '@/components/mascot/raccoonMascot.vue'
import StickerCard from '@/components/sticker/stickerCard.vue'
import UserMenu from '@/components/userMenu.vue'
import { useAuthStore } from '@/stores/modules/auth'
import { useGroupStore } from '@/stores/modules/group'
import { groupPath } from '@/stores/modules/root'
import { clearJoinIntent, consumeJoinIntent } from '@/utils/joinIntent'
import { rememberReturnTo } from '@/utils/returnTo'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const groupStore = useGroupStore()

const preview = computed(() => groupStore.groupPreview)

const { submitHandler, errors, error, isProcessing } = useFormErrorHandling(
  () => groupStore.requestToJoin(),
  () => undefined,
)

// The join view doubles as the logged-out landing page for an invite link:
// visitors see the group's name and pick login or signup, both of which
// return here. Members go straight to the feed, unknown slugs to the
// missing-group view. A non-member whose signup started on this subdomain
// carries a join intent, which submits the request for them once the preview
// loads (the flag is consumed first, so re-runs of this effect can't
// double-submit).
onMounted(() => {
  watchEffect(() => {
    if (groupStore.groupNotFound) {
      void router.replace({ name: 'groupMissing' })
      return
    }
    if (groupStore.isMember) {
      clearJoinIntent()
      void router.replace({ name: 'feed' })
      return
    }
    if (groupStore.groupPreview !== null) {
      if (authStore.loggedIn && consumeJoinIntent() && !groupStore.groupPreview.joinRequested) {
        void submitHandler()
      }
      return
    }
    void groupStore.ensureLoaded()
  })
})

async function goToAuth(name: 'logIn' | 'signUp'): Promise<void> {
  rememberReturnTo('/join')
  await router.push({ name })
}

const errorList = computed(() => Object.values(errors.value).flat())

const URL = config.APIURL + groupPath('/join_requests')
</script>

<template>
  <main id="main-content" class="auth-view">
    <user-menu />
    <p v-if="groupStore.groupLoading">{{ t('messages.loading') }}</p>
    <Message v-if="groupStore.groupError" severity="error" class="inline-message">
      {{ t('group.loadError', { error: groupStore.groupError.message }) }}
    </Message>

    <template v-if="preview !== null">
      <h1>{{ t('join.title', { group: preview.name }) }}</h1>

      <sticker-card class="join-card">
        <div class="mascot-wrap">
          <raccoon-mascot pose="logo" :size="48" />
        </div>
        <p class="group-name">{{ preview.name }}</p>
        <p>{{ t('join.memberCount', preview.memberCount) }}</p>

        <template v-if="!authStore.loggedIn">
          <p>{{ t('join.loggedOutPrompt') }}</p>
          <div class="actions">
            <Button
              type="button"
              :label="t('join.logInButton')"
              data-testid="join-login-button"
              @click="goToAuth('logIn')"
            />
            <Button
              type="button"
              severity="secondary"
              :label="t('join.signUpButton')"
              data-testid="join-signup-button"
              @click="goToAuth('signUp')"
            />
          </div>
        </template>

        <Message
          v-else-if="preview.joinRequested"
          severity="success"
          class="inline-message"
          data-testid="join-requested"
        >
          {{ t('join.requested') }}
        </Message>

        <form v-else method="post" :action="URL" @submit.prevent="submitHandler">
          <Message v-if="error" severity="error" class="inline-message" data-testid="join-error">
            {{ t('join.error', { error }) }}
          </Message>
          <Message
            v-if="errorList.length > 0"
            severity="error"
            class="inline-message"
            data-testid="join-field-errors"
          >
            <ul>
              <li v-for="message in errorList" :key="message">{{ message }}</li>
            </ul>
          </Message>

          <div class="actions">
            <Button
              type="submit"
              :label="t('join.requestButton')"
              :disabled="isProcessing"
              data-testid="join-request-button"
            />
          </div>
        </form>
      </sticker-card>
    </template>
  </main>
</template>

<style scoped lang="scss">
.join-card {
  max-width: 400px;
  margin: var(--spacing-lg) auto 0;
  text-align: center;
}

.mascot-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: var(--spacing-sm);
}

.group-name {
  font-family: var(--rb-font-display);
  font-size: 1.25rem;
  font-weight: 800;
  margin: 0 0 var(--spacing-xs);
}

.actions {
  display: flex;
  justify-content: center;
  gap: var(--spacing-sm);
}
</style>
