import { defineStore } from 'pinia'
import { Err, Ok, type Result } from 'ts-results'
import type { Errors, GroupState } from '@/stores/types'
import { groupFromJSON, groupShowFromJSON, type GroupSettingsJSONUp } from '@/stores/coding'
import type { GroupMembership } from '@/types'
import { groupPath, requestJSON } from '@/stores/modules/root'
import {
  anythingToError,
  ignoreAPIResponseBodyOrReturnErrors,
  loadAPIResponseBodyOrReturnErrors,
  loadAPIResponseBodyOrThrowErrors,
} from '@/stores/utils'
import { notifySentry } from '@/utils/errors'

const initialState: GroupState = {
  group: null,
  groupPreview: null,
  groupLoading: false,
  groupNotFound: false,
  groupError: null,
}

/**
 * The current group on a subdomain, booted once per page load. After
 * {@link useGroupStore.loadGroup} settles, exactly one of these holds: `group` (active member),
 * `groupPreview` (non-member or logged out), `groupNotFound` (no such group), or `groupError`.
 */
export const useGroupStore = defineStore('group', {
  state: () => ({ ...initialState }),

  getters: {
    /** Whether the current user is an active member of the group. */
    isMember: (state): boolean => state.group !== null,

    /** The current user's membership in the group, when a member. */
    membership: (state): GroupMembership | null => state.group?.membership ?? null,
  },

  actions: {
    reset(): void {
      this.$patch(initialState)
    },

    /**
     * Loads the group once: a no-op if a load already ran (or is running) this
     * session, so any number of views can call it safely.
     */

    async ensureLoaded(): Promise<void> {
      if (
        this.group !== null ||
        this.groupPreview !== null ||
        this.groupLoading ||
        this.groupNotFound ||
        this.groupError !== null
      ) {
        return
      }
      await this.loadGroup()
    },

    /**
     * Fetches the current group from the subdomain's slug. Works logged out
     * too: the backend serves the minimal preview to anonymous visitors.
     */

    async loadGroup(): Promise<void> {
      this.$patch({ ...initialState, groupLoading: true })
      try {
        const response = await requestJSON<unknown>({ method: 'GET', path: groupPath('') })
        if (!response.ok && response.val.response.status === 404) {
          this.$patch({ groupLoading: false, groupNotFound: true })
          return
        }

        const result = groupShowFromJSON(loadAPIResponseBodyOrThrowErrors(response))
        if (result.member) {
          this.$patch({ group: result.group, groupLoading: false })
        } else {
          this.$patch({ groupPreview: result.preview, groupLoading: false })
        }
      } catch (error) {
        this.$patch({ groupLoading: false, groupError: anythingToError(error) })
        notifySentry(error)
      }
    },

    /**
     * Updates the group's settings (name and amount limits). Admins only; the backend enforces
     * the gate. On success, replaces `group` with the updated representation.
     *
     * @param settings The new settings.
     * @returns A Result containing nothing if successful, or the validation errors if failed.
     * @throws If an HTTP error occurs.
     */

    async updateSettings(settings: GroupSettingsJSONUp): Promise<Result<void, Errors>> {
      const response = await requestJSON<unknown>({
        method: 'PATCH',
        path: groupPath(''),
        body: { group: settings },
      })
      const result = loadAPIResponseBodyOrReturnErrors(response)
      if (!result.ok) return new Err(result.val)
      this.group = groupFromJSON(result.val)
      return Ok.EMPTY
    },

    /**
     * Requests to join the group as the current user. On success, marks the
     * preview as having a pending request.
     *
     * @returns A Result containing nothing if successful, or the validation
     * errors if failed.
     * @throws If an HTTP error occurs.
     */

    async requestToJoin(): Promise<Result<void, Errors>> {
      const response = await requestJSON<unknown>({
        method: 'post',
        path: groupPath('/join_requests'),
      })
      const result = ignoreAPIResponseBodyOrReturnErrors(response)
      if (result.ok && this.groupPreview !== null) {
        this.groupPreview = { ...this.groupPreview, joinRequested: true }
      }
      return result
    },
  },
})
