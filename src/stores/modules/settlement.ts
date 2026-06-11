import { defineStore } from 'pinia'
import { Ok, type Result } from 'ts-results'
import type { Errors, SettlementState } from '@/stores/types'
import {
  balancesFromJSON,
  settlementFromJSON,
  settleUpFromJSON,
  type SettlementJSONUp,
} from '@/stores/coding'
import { groupPath, requestJSON } from '@/stores/modules/root'
import {
  anythingToError,
  loadAPIResponseBodyOrReturnAllErrors,
  loadAPIResponseBodyOrThrowErrors,
} from '@/stores/utils'
import { notifySentry } from '@/utils/errors'

const initialState: SettlementState = {
  balances: null,
  balancesLoading: false,
  balancesError: null,
  settleUpNote: null,
  transfers: null,
  transfersLoading: false,
  transfersError: null,
  settlements: null,
  settlementsLoading: false,
  settlementsError: null,
}

/** The group's ledger balances, settle-up suggestions, and settlement history. */
export const useSettlementStore = defineStore('settlement', {
  state: () => ({ ...initialState }),

  actions: {
    reset(): void {
      this.$patch(initialState)
    },

    /** Loads every member's realized balance into `balances`, largest creditors first. */

    async loadBalances(): Promise<void> {
      this.$patch({ balances: null, balancesError: null, balancesLoading: true })
      try {
        const response = await requestJSON<unknown>({ method: 'GET', path: groupPath('/balances') })
        const body = loadAPIResponseBodyOrThrowErrors(response)
        this.$patch({ balances: balancesFromJSON(body), balancesLoading: false })
      } catch (error) {
        this.$patch({ balancesLoading: false, balancesError: anythingToError(error) })
        notifySentry(error)
      }
    },

    /** Loads the suggested transfers (and payment note) into `transfers`/`settleUpNote`. */

    async loadSettleUp(): Promise<void> {
      this.$patch({ transfers: null, transfersError: null, transfersLoading: true })
      try {
        const response = await requestJSON<unknown>({
          method: 'GET',
          path: groupPath('/settle_up'),
        })
        const settleUp = settleUpFromJSON(loadAPIResponseBodyOrThrowErrors(response))
        this.$patch({
          settleUpNote: settleUp.note,
          transfers: settleUp.transfers,
          transfersLoading: false,
        })
      } catch (error) {
        this.$patch({ transfersLoading: false, transfersError: anythingToError(error) })
        notifySentry(error)
      }
    },

    /** Loads the group's recent settlements into `settlements`, newest first. */

    async loadSettlements(): Promise<void> {
      this.$patch({ settlements: null, settlementsError: null, settlementsLoading: true })
      try {
        const response = await requestJSON<unknown[]>({
          method: 'GET',
          path: groupPath('/settlements'),
        })
        const body = loadAPIResponseBodyOrThrowErrors(response)
        this.$patch({ settlements: body.map(settlementFromJSON), settlementsLoading: false })
      } catch (error) {
        this.$patch({ settlementsLoading: false, settlementsError: anythingToError(error) })
        notifySentry(error)
      }
    },

    /**
     * Records a settlement (the payer defaults to the current member on the backend), then
     * refreshes balances, suggestions, and history so the screen reflects it.
     *
     * @param settlement The settlement attributes.
     * @returns A Result containing nothing if successful, or the errors if failed.
     * @throws If an HTTP error occurs.
     */

    async recordSettlement(settlement: SettlementJSONUp): Promise<Result<void, Errors>> {
      const response = await requestJSON<unknown>({
        method: 'post',
        path: groupPath('/settlements'),
        body: { settlement },
      })
      const result = loadAPIResponseBodyOrReturnAllErrors(response)
      if (!result.ok) return result
      await this.refresh()
      return Ok.EMPTY
    },

    /**
     * Voids a settlement (reversal entries; the row is never deleted), then refreshes balances,
     * suggestions, and history.
     *
     * @param id The settlement's ID.
     * @returns A Result containing nothing if successful, or the errors if failed.
     * @throws If an HTTP error occurs.
     */

    async voidSettlement(id: number): Promise<Result<void, Errors>> {
      const response = await requestJSON<unknown>({
        method: 'delete',
        path: groupPath(`/settlements/${String(id)}`),
      })
      const result = loadAPIResponseBodyOrReturnAllErrors(response)
      if (!result.ok) return result
      await this.refresh()
      return Ok.EMPTY
    },

    async refresh(): Promise<void> {
      await Promise.all([this.loadBalances(), this.loadSettleUp(), this.loadSettlements()])
    },
  },
})
