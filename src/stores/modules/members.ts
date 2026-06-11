import { defineStore } from 'pinia'
import { Ok, type Result } from 'ts-results'
import type { Errors, MembersState } from '@/stores/types'
import { invitationFromJSON, memberFromJSON, type InvitationJSONUp } from '@/stores/coding'
import type { Member } from '@/types'
import { groupPath, requestJSON } from '@/stores/modules/root'
import {
  anythingToError,
  ignoreAPIResponseBodyOrReturnAllErrors,
  loadAPIResponseBodyOrReturnAllErrors,
  loadAPIResponseBodyOrThrowErrors,
} from '@/stores/utils'
import { notifySentry } from '@/utils/errors'

const initialState: MembersState = {
  members: null,
  membersLoading: false,
  membersError: null,
  joinRequests: null,
  joinRequestsLoading: false,
  joinRequestsError: null,
  invitations: null,
  invitationsLoading: false,
  invitationsError: null,
}

/** The group's roster plus the admin tools: role changes, removal, join requests, invitations. */
export const useMembersStore = defineStore('members', {
  state: () => ({ ...initialState }),

  actions: {
    reset(): void {
      this.$patch(initialState)
    },

    /** Loads the group's active members into `members`, oldest first. */

    async loadMembers(): Promise<void> {
      await this.loadList('members', '/members', (body) => {
        this.members = body.map(memberFromJSON)
      })
    },

    /** Loads the group's pending join requests into `joinRequests`, oldest first. Admins only. */

    async loadJoinRequests(): Promise<void> {
      await this.loadList('joinRequests', '/join_requests', (body) => {
        this.joinRequests = body.map(memberFromJSON)
      })
    },

    /** Loads the group's pending invitations into `invitations`, oldest first. Admins only. */

    async loadInvitations(): Promise<void> {
      await this.loadList('invitations', '/invitations', (body) => {
        this.invitations = body.map(invitationFromJSON)
      })
    },

    /**
     * Changes a member's role. Admins only; the backend rejects demoting the group's last admin
     * with a `base` error.
     *
     * @param member The member to change.
     * @param role The new role.
     * @returns A Result containing nothing if successful, or the errors if failed.
     * @throws If an HTTP error occurs.
     */

    async updateRole(member: Member, role: 'member' | 'admin'): Promise<Result<void, Errors>> {
      const response = await requestJSON<unknown>({
        method: 'PATCH',
        path: groupPath(`/members/${String(member.id)}`),
        body: { membership: { role } },
      })
      const result = loadAPIResponseBodyOrReturnAllErrors(response)
      if (!result.ok) return result
      const updated = memberFromJSON(result.val)
      this.members = (this.members ?? []).map((each) => (each.id === updated.id ? updated : each))
      return Ok.EMPTY
    },

    /**
     * Removes a member from the group. Admins can remove anyone; the backend rejects removing
     * the group's last admin with a `base` error.
     *
     * @param member The member to remove.
     * @returns A Result containing nothing if successful, or the errors if failed.
     * @throws If an HTTP error occurs.
     */

    async removeMember(member: Member): Promise<Result<void, Errors>> {
      const response = await requestJSON<unknown>({
        method: 'delete',
        path: groupPath(`/members/${String(member.id)}`),
      })
      const result = ignoreAPIResponseBodyOrReturnAllErrors(response)
      if (result.ok) this.members = (this.members ?? []).filter((each) => each.id !== member.id)
      return result
    },

    /**
     * Approves a join request, activating the membership. Admins only.
     *
     * @param request The requested membership to approve.
     * @returns A Result containing nothing if successful, or the errors if failed.
     * @throws If an HTTP error occurs.
     */

    async approveJoinRequest(request: Member): Promise<Result<void, Errors>> {
      const response = await requestJSON<unknown>({
        method: 'post',
        path: groupPath(`/join_requests/${String(request.id)}/approve`),
      })
      const result = loadAPIResponseBodyOrReturnAllErrors(response)
      if (!result.ok) return result
      this.joinRequests = (this.joinRequests ?? []).filter((each) => each.id !== request.id)
      this.members = [...(this.members ?? []), memberFromJSON(result.val)]
      return Ok.EMPTY
    },

    /**
     * Denies a join request, destroying the requested membership. Admins only.
     *
     * @param request The requested membership to deny.
     * @returns A Result containing nothing if successful, or the errors if failed.
     * @throws If an HTTP error occurs.
     */

    async denyJoinRequest(request: Member): Promise<Result<void, Errors>> {
      const response = await requestJSON<unknown>({
        method: 'delete',
        path: groupPath(`/join_requests/${String(request.id)}`),
      })
      const result = ignoreAPIResponseBodyOrReturnAllErrors(response)
      if (result.ok) {
        this.joinRequests = (this.joinRequests ?? []).filter((each) => each.id !== request.id)
      }
      return result
    },

    /**
     * Invites someone to the group by email. Admins only.
     *
     * @param invitation The invitee's email and role.
     * @returns A Result containing nothing if successful, or the validation errors if failed.
     * @throws If an HTTP error occurs.
     */

    async createInvitation(invitation: InvitationJSONUp): Promise<Result<void, Errors>> {
      const response = await requestJSON<unknown>({
        method: 'post',
        path: groupPath('/invitations'),
        body: { invitation },
      })
      const result = loadAPIResponseBodyOrReturnAllErrors(response)
      if (!result.ok) return result
      this.invitations = [...(this.invitations ?? []), invitationFromJSON(result.val)]
      return Ok.EMPTY
    },

    /**
     * Revokes a pending invitation. Admins only.
     *
     * @param id The invitation's ID.
     * @returns A Result containing nothing if successful, or the errors if failed.
     * @throws If an HTTP error occurs.
     */

    async revokeInvitation(id: number): Promise<Result<void, Errors>> {
      const response = await requestJSON<unknown>({
        method: 'delete',
        path: groupPath(`/invitations/${String(id)}`),
      })
      const result = ignoreAPIResponseBodyOrReturnAllErrors(response)
      if (result.ok) this.invitations = (this.invitations ?? []).filter((each) => each.id !== id)
      return result
    },

    async loadList(
      key: 'members' | 'joinRequests' | 'invitations',
      path: string,
      assign: (body: unknown[]) => void,
    ): Promise<void> {
      this[key] = null
      this[`${key}Error`] = null
      this[`${key}Loading`] = true
      try {
        const response = await requestJSON<unknown[]>({ method: 'GET', path: groupPath(path) })
        assign(loadAPIResponseBodyOrThrowErrors(response))
        this[`${key}Loading`] = false
      } catch (error) {
        this[`${key}Loading`] = false
        this[`${key}Error`] = anythingToError(error)
        notifySentry(error)
      }
    },
  },
})
