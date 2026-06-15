import { defineStore } from 'pinia'
import { Ok, type Result } from 'ts-results'
import type { Errors, MarketState } from '@/stores/types'
import {
  marketDetailFromJSON,
  type CommentJSONUp,
  type PositionJSONUp,
  type MarketUpdateJSONUp,
} from '@/stores/coding'
import type { MarketDetail } from '@/types'
import { groupPath, requestJSON } from '@/stores/modules/root'
import {
  anythingToError,
  ignoreAPIResponseBodyOrReturnAllErrors,
  ignoreAPIResponseBodyOrReturnErrors,
  loadAPIResponseBodyOrReturnAllErrors,
  loadAPIResponseBodyOrThrowErrors,
} from '@/stores/utils'
import { notifySentry } from '@/utils/errors'

const initialState: MarketState = {
  market: null,
  marketLoading: false,
  marketNotFound: false,
  marketError: null,
}

/** A single market in detail, plus the viewing member's position on it. */
export const useMarketStore = defineStore('market', {
  state: () => ({ ...initialState }),

  actions: {
    reset(): void {
      this.$patch(initialState)
    },

    /**
     * Seeds the store with a market already in hand (e.g. the response to
     * creating it), so the detail view needn't refetch.
     *
     * @param market The market to display.
     */

    setMarket(market: MarketDetail): void {
      this.$patch({ ...initialState, market })
    },

    /**
     * Loads a market in full. While a refresh of the already-displayed market is
     * in flight, the stale copy stays visible.
     *
     * @param id The market's ID.
     */

    async loadMarket(id: number): Promise<void> {
      if (this.market?.id !== id) this.market = null
      this.$patch({ marketError: null, marketNotFound: false, marketLoading: true })
      try {
        const response = await requestJSON<unknown>({
          method: 'GET',
          path: groupPath(`/markets/${String(id)}`),
        })
        if (!response.ok && response.val.response.status === 404) {
          this.$patch({ market: null, marketLoading: false, marketNotFound: true })
          return
        }
        const body = loadAPIResponseBodyOrThrowErrors(response)
        this.$patch({ market: marketDetailFromJSON(body), marketLoading: false })
      } catch (error) {
        this.$patch({ marketLoading: false, marketError: anythingToError(error) })
        notifySentry(error)
      }
    },

    /**
     * Updates the loaded market's editable attributes. Creator or group admin, while the market
     * is open. On success the store holds the updated market.
     *
     * @param attributes The new title, description, and `locks_at`.
     * @returns A Result containing nothing if successful, or the errors (business-rule
     * rejections land under `base`) if failed.
     * @throws If an HTTP error occurs, or when no market is loaded.
     */

    async updateMarket(attributes: MarketUpdateJSONUp): Promise<Result<void, Errors>> {
      const market = this.requireMarket()
      const response = await requestJSON<unknown>({
        // Uppercased explicitly: fetch normalizes the common verbs but not PATCH.
        method: 'PATCH',
        path: groupPath(`/markets/${String(market.id)}`),
        body: { market: attributes },
      })
      const result = loadAPIResponseBodyOrReturnAllErrors(response)
      if (!result.ok) return result
      this.setMarket(marketDetailFromJSON(result.val))
      return Ok.EMPTY
    },

    /**
     * Places or updates the viewing member's position on the loaded market, then
     * reloads the market so pools and the position list reflect it.
     *
     * @param position The outcome and amount (in minor units).
     * @returns A Result containing nothing if successful, or the validation
     * errors if failed.
     * @throws If an HTTP error occurs, or when no market is loaded.
     */

    async placePosition(position: PositionJSONUp): Promise<Result<void, Errors>> {
      const market = this.requireMarket()
      const response = await requestJSON<unknown>({
        method: 'put',
        path: groupPath(`/markets/${String(market.id)}/position`),
        body: { position },
      })
      const result = ignoreAPIResponseBodyOrReturnErrors(response)
      if (result.ok) await this.loadMarket(market.id)
      return result
    },

    /**
     * Cancels the viewing member's position on the loaded market, then reloads the
     * market.
     *
     * @returns A Result containing nothing if successful, or the validation
     * errors if failed.
     * @throws If an HTTP error occurs, or when no market is loaded.
     */

    async cancelPosition(): Promise<Result<void, Errors>> {
      const market = this.requireMarket()
      const response = await requestJSON<unknown>({
        method: 'delete',
        path: groupPath(`/markets/${String(market.id)}/position`),
      })
      const result = ignoreAPIResponseBodyOrReturnErrors(response)
      if (result.ok) await this.loadMarket(market.id)
      return result
    },

    /**
     * Deletes the loaded market. Group admins only; the backend refuses (422) once any money
     * has moved. On success the market is gone — the caller navigates away.
     *
     * @returns A Result containing nothing if successful, or the errors (the ledger
     * restriction lands under `base`) if failed.
     * @throws If an HTTP error occurs, or when no market is loaded.
     */

    async deleteMarket(): Promise<Result<void, Errors>> {
      const market = this.requireMarket()
      const response = await requestJSON<unknown>({
        method: 'delete',
        path: groupPath(`/markets/${String(market.id)}`),
      })
      return ignoreAPIResponseBodyOrReturnAllErrors(response)
    },

    /**
     * Cancels another member's position on the loaded market (group admins only), then
     * reloads the market. The backend emails the position's owner.
     *
     * @param positionId The position's ID.
     * @returns A Result containing nothing if successful, or the validation errors if failed.
     * @throws If an HTTP error occurs, or when no market is loaded.
     */

    async cancelMemberPosition(positionId: number): Promise<Result<void, Errors>> {
      const market = this.requireMarket()
      const response = await requestJSON<unknown>({
        method: 'delete',
        path: groupPath(`/markets/${String(market.id)}/positions/${String(positionId)}`),
      })
      const result = ignoreAPIResponseBodyOrReturnAllErrors(response)
      if (result.ok) await this.loadMarket(market.id)
      return result
    },

    /**
     * Resolves the loaded market to an outcome, writing the win/loss ledger entries. Oracle or
     * group admin. On success the store holds the updated market, payouts included.
     *
     * @param outcomeId The winning outcome's ID.
     * @param effectiveAt The cutoff to settle the pool as of, for an early resolution; bets placed
     * or raised after it are excluded. Omit (or pass null) to resolve a scheduled market normally.
     * @returns A Result containing nothing if successful, or the errors (business-rule
     * rejections land under `base`) if failed.
     * @throws If an HTTP error occurs, or when no market is loaded.
     */

    async resolve(outcomeId: number, effectiveAt?: Date | null): Promise<Result<void, Errors>> {
      const body: Record<string, unknown> = { outcome_id: outcomeId }
      if (effectiveAt !== null && effectiveAt !== undefined) {
        body.effective_at = effectiveAt.toISOString()
      }
      return this.requestResolution('post', body)
    },

    /**
     * Corrects the loaded, resolved market to a different outcome. Group admin only.
     *
     * @param outcomeId The corrected winning outcome's ID.
     * @returns A Result containing nothing if successful, or the errors (business-rule
     * rejections land under `base`) if failed.
     * @throws If an HTTP error occurs, or when no market is loaded.
     */

    async correct(outcomeId: number): Promise<Result<void, Errors>> {
      return this.requestResolution('put', { outcome_id: outcomeId })
    },

    /**
     * Voids the loaded market, reversing its ledger entries if it was resolved. Oracle or group
     * admin.
     *
     * @returns A Result containing nothing if successful, or the errors (business-rule
     * rejections land under `base`) if failed.
     * @throws If an HTTP error occurs, or when no market is loaded.
     */

    async voidMarket(): Promise<Result<void, Errors>> {
      return this.requestResolution('delete')
    },

    /**
     * Posts a comment to the loaded market. Any active member, any market state. On success the
     * store holds the market with the new comment.
     *
     * @param comment The comment body.
     * @returns A Result containing nothing if successful, or the validation errors if failed.
     * @throws If an HTTP error occurs, or when no market is loaded.
     */

    async addComment(comment: CommentJSONUp): Promise<Result<void, Errors>> {
      const market = this.requireMarket()
      const response = await requestJSON<unknown>({
        method: 'post',
        path: groupPath(`/markets/${String(market.id)}/comments`),
        body: { comment },
      })
      const result = loadAPIResponseBodyOrReturnAllErrors(response)
      if (!result.ok) return result
      this.setMarket(marketDetailFromJSON(result.val))
      return Ok.EMPTY
    },

    /**
     * Deletes a comment on the loaded market. The author or a group admin only. On success the
     * store holds the market without the comment.
     *
     * @param commentId The comment's ID.
     * @returns A Result containing nothing if successful, or the errors (a forbidden delete lands
     * under `base`) if failed.
     * @throws If an HTTP error occurs, or when no market is loaded.
     */

    async deleteComment(commentId: number): Promise<Result<void, Errors>> {
      const market = this.requireMarket()
      const response = await requestJSON<unknown>({
        method: 'delete',
        path: groupPath(`/markets/${String(market.id)}/comments/${String(commentId)}`),
      })
      const result = loadAPIResponseBodyOrReturnAllErrors(response)
      if (!result.ok) return result
      this.setMarket(marketDetailFromJSON(result.val))
      return Ok.EMPTY
    },

    async requestResolution(
      method: string,
      body?: Record<string, unknown>,
    ): Promise<Result<void, Errors>> {
      const market = this.requireMarket()
      const response = await requestJSON<unknown>({
        method,
        path: groupPath(`/markets/${String(market.id)}/resolution`),
        body,
      })
      const result = loadAPIResponseBodyOrReturnAllErrors(response)
      if (!result.ok) return result
      this.setMarket(marketDetailFromJSON(result.val))
      return Ok.EMPTY
    },

    requireMarket(): MarketDetail {
      if (this.market === null) throw new Error('No market loaded')
      return this.market
    },
  },
})
