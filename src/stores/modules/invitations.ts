import { defineStore } from 'pinia'
import type { Group, InvitationPreview } from '@/types'
import { groupFromJSON, invitationPreviewFromJSON } from '@/stores/coding'
import { requestJSON } from '@/stores/modules/root'
import { loadAPIResponseBodyOrThrowErrors } from '@/stores/utils'

// Revoked invitations are destroyed (404) and expired or already-accepted
// ones render 410 Gone; both mean "this link no longer works".
const GONE_STATUSES = new Set([404, 410])

/**
 * Previewing and accepting emailed invitations by token. These are global routes (invitees
 * aren't members yet), unlike the admin-side invitation management in the members store.
 */
export const useInvitationsStore = defineStore('invitations', {
  actions: {
    /**
     * Loads the preview of an emailed invitation.
     *
     * @param token The invitation token from the emailed link.
     * @returns The preview, or `null` when the invitation no longer exists.
     * @throws If an HTTP error occurs.
     */

    async loadPreview(token: string): Promise<InvitationPreview | null> {
      const response = await requestJSON<unknown>({
        method: 'GET',
        path: `/invitations/${encodeURIComponent(token)}`,
      })
      if (!response.ok && GONE_STATUSES.has(response.val.response.status)) return null
      return invitationPreviewFromJSON(loadAPIResponseBodyOrThrowErrors(response))
    },

    /**
     * Accepts an emailed invitation, joining the current user to its group.
     *
     * @param token The invitation token from the emailed link.
     * @returns The joined group, or `null` when the invitation is no longer valid.
     * @throws If an HTTP error occurs.
     */

    async accept(token: string): Promise<Group | null> {
      const response = await requestJSON<unknown>({
        method: 'post',
        path: `/invitations/${encodeURIComponent(token)}/accept`,
      })
      if (!response.ok && GONE_STATUSES.has(response.val.response.status)) return null
      return groupFromJSON(loadAPIResponseBodyOrThrowErrors(response))
    },
  },
})
