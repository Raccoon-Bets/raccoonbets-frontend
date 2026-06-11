import { defineStore } from 'pinia'
import { Err, Ok, type Result } from 'ts-results'
import type { Errors, GroupsState } from '@/stores/types'
import { availabilityFromJSON, groupFromJSON, type GroupJSONUp } from '@/stores/coding'
import type { Group } from '@/types'
import { requestJSON } from '@/stores/modules/root'
import {
  anythingToError,
  loadAPIResponseBodyOrReturnErrors,
  loadAPIResponseBodyOrThrowErrors,
} from '@/stores/utils'
import { notifySentry } from '@/utils/errors'
import { useAuthStore } from '@/stores/modules/auth'

const initialState: GroupsState = {
  myGroups: null,
  myGroupsLoading: false,
  myGroupsError: null,
}

export const useGroupsStore = defineStore('groups', {
  state: () => ({ ...initialState }),
  actions: {
    reset(): void {
      this.$patch(initialState)
    },

    /**
     * Loads the groups the current user is an active member of into
     * `myGroups`. Does nothing if not logged in.
     *
     * @throws If an HTTP error occurs.
     */

    async loadMyGroups(): Promise<void> {
      const auth = useAuthStore()

      if (!auth.loggedIn) return

      this.$patch({
        myGroups: null,
        myGroupsError: null,
        myGroupsLoading: true,
      })
      try {
        const response = await requestJSON<unknown[]>({
          method: 'GET',
          path: '/groups',
        })
        const body = loadAPIResponseBodyOrThrowErrors(response)
        this.$patch({
          myGroups: body.map(groupFromJSON),
          myGroupsLoading: false,
        })
      } catch (error) {
        this.$patch({
          myGroups: null,
          myGroupsLoading: false,
          myGroupsError: anythingToError(error),
        })
        notifySentry(error)
      }
    },

    /**
     * Creates a new group; the current user becomes its first admin.
     *
     * @param group The group attributes (name, subdomain, currency, optional
     * amount limits in minor units).
     * @returns A Result containing the created group if successful, or the
     * validation errors if failed.
     * @throws If an HTTP error occurs.
     */

    async createGroup(group: GroupJSONUp): Promise<Result<Group, Errors>> {
      const response = await requestJSON<unknown>({
        method: 'post',
        path: '/groups',
        body: { group },
      })
      const result = loadAPIResponseBodyOrReturnErrors(response)
      if (result.ok) return new Ok(groupFromJSON(result.val))
      return new Err(result.val)
    },

    /**
     * Checks whether a subdomain is available for a new group. A pure call
     * with no store state, so callers can debounce it freely.
     *
     * @param subdomain The candidate subdomain slug.
     * @returns Whether the subdomain is available.
     * @throws If an HTTP error occurs.
     */

    async checkAvailability(subdomain: string): Promise<boolean> {
      const query = new URLSearchParams({ subdomain })
      const response = await requestJSON<unknown>({
        method: 'GET',
        path: `/groups/availability?${query.toString()}`,
      })
      return availabilityFromJSON(loadAPIResponseBodyOrThrowErrors(response))
    },
  },
})
