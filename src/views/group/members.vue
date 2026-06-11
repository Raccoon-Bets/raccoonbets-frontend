<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Message from 'primevue/message'
import Select from 'primevue/select'
import config from '@/config'
import FieldErrors from '@/components/fieldErrors.vue'
import FormField from '@/components/formField.vue'
import GroupShell from '@/components/group/groupShell.vue'
import StickerBadge from '@/components/sticker/stickerBadge.vue'
import StickerCard from '@/components/sticker/stickerCard.vue'
import useFormErrorHandling from '@/composables/useFormErrorHandling'
import useGroupGuard from '@/composables/useGroupGuard'
import { useGroupStore } from '@/stores/modules/group'
import { useMembersStore } from '@/stores/modules/members'
import { groupPath } from '@/stores/modules/root'
import type { Errors } from '@/stores/types'
import { errorToString, notifySentry } from '@/utils/errors'
import type { Member } from '@/types'
import type { Result } from 'ts-results'

const { t, d } = useI18n()
const groupStore = useGroupStore()
const membersStore = useMembersStore()
useGroupGuard()

const isAdmin = computed(() => groupStore.membership?.role === 'admin')

watch(
  () => groupStore.isMember,
  (isMember) => {
    if (!isMember) return
    void membersStore.loadMembers()
    if (isAdmin.value) {
      void membersStore.loadJoinRequests()
      void membersStore.loadInvitations()
    }
  },
  { immediate: true },
)

const isMe = (member: Member): boolean => member.id === groupStore.membership?.id

// ── Roster and join-request actions ───────────────────────────────────
// All row actions share one error line; business-rule rejections (e.g. the
// last admin) read fine without per-row placement.

const actionError = ref<string | null>(null)

async function performAction(action: () => Promise<Result<void, Errors>>): Promise<void> {
  actionError.value = null
  try {
    const result = await action()
    if (!result.ok) actionError.value = Object.values(result.val).flat().join(', ')
  } catch (error) {
    notifySentry(error)
    actionError.value = errorToString(error)
  }
}

const toggleRole = (member: Member) =>
  performAction(() => membersStore.updateRole(member, member.role === 'admin' ? 'member' : 'admin'))

async function removeMember(member: Member): Promise<void> {
  if (!window.confirm(t('members.removeConfirm', { name: member.user.name }))) return
  await performAction(() => membersStore.removeMember(member))
}

const approve = (request: Member) => performAction(() => membersStore.approveJoinRequest(request))

async function deny(request: Member): Promise<void> {
  if (!window.confirm(t('members.joinRequests.denyConfirm', { name: request.user.name }))) return
  await performAction(() => membersStore.denyJoinRequest(request))
}

const revokeInvitation = (id: number) => performAction(() => membersStore.revokeInvitation(id))

// ── Invitation form ───────────────────────────────────────────────────

const invitation = reactive<{ email: string; role: 'member' | 'admin' }>({
  email: '',
  role: 'member',
})

const ROLE_OPTIONS = computed(() => [
  { label: t('members.role.member'), value: 'member' as const },
  { label: t('members.role.admin'), value: 'admin' as const },
])

const {
  submitHandler: inviteHandler,
  errors: inviteErrors,
  error: inviteError,
  isProcessing: isInviting,
} = useFormErrorHandling(
  () => membersStore.createInvitation({ email: invitation.email, role: invitation.role }),
  () => {
    invitation.email = ''
    invitation.role = 'member'
  },
)
// Errors not tied to the email field (e.g. an already-invited address) render above the form.
const inviteBaseErrors = computed(() =>
  Object.entries(inviteErrors.value)
    .filter(([field]) => field !== 'email')
    .flatMap(([, messages]) => messages),
)

const inviteURL = config.APIURL + groupPath('/invitations')
</script>

<template>
  <main id="main-content" class="group-view">
    <group-shell>
      <h2>{{ t('members.title') }}</h2>

      <Message
        v-if="actionError"
        severity="error"
        class="inline-message"
        data-testid="members-action-error"
      >
        {{ t('members.actionError', { error: actionError }) }}
      </Message>

      <sticker-card class="detail-section">
        <Message v-if="membersStore.membersError" severity="error" class="inline-message">
          {{ t('members.error', { error: membersStore.membersError.message }) }}
        </Message>
        <p v-if="membersStore.membersLoading">{{ t('messages.loading') }}</p>

        <DataTable
          v-if="membersStore.members !== null"
          :value="membersStore.members"
          data-testid="members-roster"
        >
          <Column :header="t('members.columns.name')">
            <template #body="{ data }">
              <span class="name" :data-testid="`member-${data.id}`">{{ data.user.name }}</span>
              <small v-if="isMe(data)" class="you-tag">{{ t('members.youTag') }}</small>
            </template>
          </Column>
          <Column :header="t('members.columns.role')">
            <template #body="{ data }">
              <sticker-badge
                :tilt="0"
                :tone="data.role === 'admin' ? 'info' : 'muted'"
                :data-testid="`member-${data.id}-role`"
              >
                {{ t(`members.role.${data.role}`) }}
              </sticker-badge>
            </template>
          </Column>
          <!-- Admins can act on themselves too (step down, leave); the backend
               rejects orphaning the group of its last admin and the 422
               surfaces in the shared action error line. -->
          <Column v-if="isAdmin">
            <template #body="{ data }">
              <div class="row-actions">
                <Button
                  type="button"
                  size="small"
                  severity="secondary"
                  :label="data.role === 'admin' ? t('members.makeMember') : t('members.makeAdmin')"
                  :data-testid="`member-${data.id}-toggle-role`"
                  @click="toggleRole(data)"
                />
                <Button
                  type="button"
                  size="small"
                  severity="danger"
                  outlined
                  :label="t('members.remove')"
                  :data-testid="`member-${data.id}-remove`"
                  @click="removeMember(data)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </sticker-card>

      <template v-if="isAdmin">
        <sticker-card class="detail-section" data-testid="join-requests">
          <h2 class="section-head">{{ t('members.joinRequests.title') }}</h2>
          <Message v-if="membersStore.joinRequestsError" severity="error" class="inline-message">
            {{ t('members.joinRequests.error', { error: membersStore.joinRequestsError.message }) }}
          </Message>
          <p v-if="membersStore.joinRequestsLoading">{{ t('messages.loading') }}</p>
          <p
            v-if="membersStore.joinRequests !== null && membersStore.joinRequests.length === 0"
            data-testid="join-requests-empty"
          >
            {{ t('members.joinRequests.empty') }}
          </p>
          <ul v-if="membersStore.joinRequests !== null" class="roster">
            <li
              v-for="request in membersStore.joinRequests"
              :key="request.id"
              :data-testid="`join-request-${request.id}`"
            >
              <span class="name">{{ request.user.name }}</span>
              <Button
                type="button"
                size="small"
                :label="t('members.joinRequests.approve')"
                :data-testid="`join-request-${request.id}-approve`"
                @click="approve(request)"
              />
              <Button
                type="button"
                size="small"
                severity="danger"
                outlined
                :label="t('members.joinRequests.deny')"
                :data-testid="`join-request-${request.id}-deny`"
                @click="deny(request)"
              />
            </li>
          </ul>
        </sticker-card>

        <sticker-card class="detail-section" data-testid="invitations">
          <h2 class="section-head">{{ t('members.invitations.title') }}</h2>
          <Message v-if="membersStore.invitationsError" severity="error" class="inline-message">
            {{ t('members.invitations.error', { error: membersStore.invitationsError.message }) }}
          </Message>
          <p v-if="membersStore.invitationsLoading">{{ t('messages.loading') }}</p>
          <p
            v-if="membersStore.invitations !== null && membersStore.invitations.length === 0"
            data-testid="invitations-empty"
          >
            {{ t('members.invitations.empty') }}
          </p>
          <ul v-if="membersStore.invitations !== null" class="roster">
            <li
              v-for="pending in membersStore.invitations"
              :key="pending.id"
              :data-testid="`invitation-${pending.id}`"
            >
              <span class="name">{{ pending.email }}</span>
              <sticker-badge :tilt="0" :tone="pending.role === 'admin' ? 'info' : 'muted'">
                {{ t(`members.role.${pending.role}`) }}
              </sticker-badge>
              <small>
                {{ t('members.invitations.sent', { date: d(pending.createdAt, 'long') }) }}
              </small>
              <Button
                type="button"
                size="small"
                severity="danger"
                outlined
                :label="t('members.invitations.revoke')"
                :data-testid="`invitation-${pending.id}-revoke`"
                @click="revokeInvitation(pending.id)"
              />
            </li>
          </ul>

          <Message
            v-if="inviteError"
            severity="error"
            class="inline-message"
            data-testid="invite-error"
          >
            {{ t('members.invitations.createError', { error: inviteError }) }}
          </Message>
          <Message
            v-if="inviteBaseErrors.length > 0"
            severity="error"
            class="inline-message"
            data-testid="invite-base-errors"
          >
            <ul>
              <li v-for="message in inviteBaseErrors" :key="message">{{ message }}</li>
            </ul>
          </Message>

          <form method="post" :action="inviteURL" @submit.prevent="inviteHandler">
            <form-field
              v-model="invitation.email"
              type="email"
              object="invitation"
              field="email"
              :errors="inviteErrors"
              :label="t('members.invitations.emailLabel')"
              required
              data-testid="invitation-email"
            />
            <div class="form-field">
              <label for="invitation-role">{{ t('members.invitations.roleLabel') }}</label>
              <Select
                v-model="invitation.role"
                input-id="invitation-role"
                :options="ROLE_OPTIONS"
                option-label="label"
                option-value="value"
                fluid
                data-testid="invitation-role"
              />
              <field-errors field="role" :messages="inviteErrors.role ?? []" />
            </div>
            <div class="actions">
              <Button
                type="submit"
                :label="t('members.invitations.button')"
                :disabled="isInviting"
                data-testid="invitation-submit"
              />
            </div>
          </form>
        </sticker-card>
      </template>
    </group-shell>
  </main>
</template>

<style scoped lang="scss">
.name {
  font-weight: 600;
}

.you-tag {
  margin-left: var(--spacing-sm);
}

.row-actions {
  display: flex;
  gap: var(--spacing-sm);
}

ul.roster {
  padding: 0;
  margin: 0;
  list-style: none;

  li {
    display: flex;
    gap: var(--spacing-md);
    align-items: center;
    padding: var(--spacing-xs) 0;
    border-bottom: 1px solid var(--p-content-border-color);

    .name {
      flex: 1;
    }
  }
}
</style>
