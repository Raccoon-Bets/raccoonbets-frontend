import { defineStore } from 'pinia'
import { Err, Ok, type Result } from 'ts-results'
import type { Errors, MarketsState } from '@/stores/types'
import { marketDetailFromJSON, marketFromJSON, type MarketJSONUp } from '@/stores/coding'
import type { MarketDetail } from '@/types'
import { groupPath, requestJSON } from '@/stores/modules/root'
import {
  anythingToError,
  loadAPIResponseBodyOrReturnErrors,
  loadAPIResponseBodyOrThrowErrors,
} from '@/stores/utils'
import { notifySentry } from '@/utils/errors'

/** An optional `GET /markets` status filter. `locked` means open but past `locks_at`. */
export type MarketStatusFilter = 'open' | 'locked' | 'resolved' | 'voided'

const initialState: MarketsState = {
  markets: null,
  marketsLoading: false,
  marketsError: null,
}

/** The group's market list (the feed) and market creation. */
export const useMarketsStore = defineStore('markets', {
  state: () => ({ ...initialState }),

  actions: {
    reset(): void {
      this.$patch(initialState)
    },

    /**
     * Loads the group's markets into `markets`: open markets first by soonest
     * `locks_at`, then concluded markets, most recent first. While a refresh is
     * in flight (e.g. from a realtime event), the stale list stays visible.
     *
     * @param status Optionally narrows the list to one status.
     */

    async loadMarkets(status?: MarketStatusFilter): Promise<void> {
      this.$patch({ marketsError: null, marketsLoading: true })
      try {
        const query = status === undefined ? '' : `?${new URLSearchParams({ status }).toString()}`
        const response = await requestJSON<unknown[]>({
          method: 'GET',
          path: groupPath(`/markets${query}`),
        })
        const body = loadAPIResponseBodyOrThrowErrors(response)
        this.$patch({ markets: body.map(marketFromJSON), marketsLoading: false })
      } catch (error) {
        this.$patch({ marketsLoading: false, marketsError: anythingToError(error) })
        notifySentry(error)
      }
    },

    /**
     * Creates a market with its outcomes. The oracle defaults to the creator
     * when `oracle_id` is omitted.
     *
     * @param market The market attributes, including at least two outcome names.
     * @returns A Result containing the created market if successful, or the
     * validation errors if failed.
     * @throws If an HTTP error occurs.
     */

    async createMarket(market: MarketJSONUp): Promise<Result<MarketDetail, Errors>> {
      const response = await requestJSON<unknown>({
        method: 'post',
        path: groupPath('/markets'),
        body: { market },
      })
      const result = loadAPIResponseBodyOrReturnErrors(response)
      if (result.ok) return new Ok(marketDetailFromJSON(result.val))
      return new Err(result.val)
    },
  },
})
