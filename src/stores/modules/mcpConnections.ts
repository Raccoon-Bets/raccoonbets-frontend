import { defineStore } from 'pinia'
import { z } from 'zod'
import type { APIFailure, APIResponse, McpConnectionsState } from '@/stores/types'
import type { McpConnection, McpConsent } from '@/types'
import { mcpConnectionsFromJSON, mcpConsentFromJSON, mcpDecisionFromJSON } from '@/stores/coding'
import { request, requestJSON } from '@/stores/modules/root'
import {
  anythingToError,
  ignoreResponseBody,
  LocalizableError,
  loadAPIResponseBodyOrThrowErrors,
} from '@/stores/utils'
import { ExpectedError, notifySentry } from '@/utils/errors'
import { global } from '@/i18n'

const consentErrorCodeSchema = z.enum([
  'request_unavailable',
  'account_unavailable',
  'mcp_disabled',
  'invalid_request',
])

type ConsentErrorCode = z.infer<typeof consentErrorCodeSchema>

const consentErrorCodesByStatus: Partial<Record<number, ConsentErrorCode>> = {
  400: 'invalid_request',
  403: 'account_unavailable',
  404: 'request_unavailable',
}

function consentError({ response, body }: APIFailure): Error {
  const code =
    consentErrorCodeSchema.safeParse(body.error).data ?? consentErrorCodesByStatus[response.status]
  if (code === undefined)
    return new LocalizableError('error.badResponse', { status: response.status })
  return new ExpectedError(global.t(`auth.mcpConsent.errors.${code}`))
}

function consentResponseBody<T>(response: APIResponse<T>): T {
  if (!response.ok) throw consentError(response.val)
  return loadAPIResponseBodyOrThrowErrors(response)
}

function consentPath(id: string): string {
  return `/oauth/requests/${encodeURIComponent(id)}`
}

async function decide(id: string, body: Record<string, unknown>): Promise<string> {
  const response = await requestJSON<unknown>({
    method: 'post',
    path: `${consentPath(id)}/decision`,
    body,
  })
  return mcpDecisionFromJSON(consentResponseBody(response))
}

const initialState: McpConnectionsState = {
  connections: null,
  connectionsLoading: false,
  connectionsError: null,
  revokingID: null,
}

/** Assistant (MCP) access to the member's account: consent to new connections and managing them. */
export const useMcpConnectionsStore = defineStore('mcpConnections', {
  state: () => ({ ...initialState }),

  actions: {
    reset(): void {
      this.$patch(initialState)
    },

    /**
     * Loads a pending consent request along with the groups the member can share.
     *
     * @param id The consent request's ID.
     * @returns The consent request.
     * @throws An error with a localized, user-facing message if the request can't be shown.
     */

    async loadConsent(id: string): Promise<McpConsent> {
      const response = await requestJSON<unknown>({ path: consentPath(id) })
      return mcpConsentFromJSON(consentResponseBody(response))
    },

    /**
     * Approves a consent request for the chosen groups and access level.
     *
     * @param id The consent request's ID.
     * @param groupIDs The groups to share.
     * @param write Whether the assistant may act on the member's behalf.
     * @returns The assistant's callback URL carrying the authorization code.
     * @throws An error with a localized, user-facing message if the request can't be approved.
     */

    async approve(id: string, groupIDs: number[], write: boolean): Promise<string> {
      return decide(id, { approve: true, group_ids: groupIDs, write })
    },

    /**
     * Denies a consent request.
     *
     * @param id The consent request's ID.
     * @returns The assistant's callback URL carrying the denial.
     * @throws An error with a localized, user-facing message if the request can't be denied.
     */

    async deny(id: string): Promise<string> {
      return decide(id, { approve: false })
    },

    /** Loads the member's usable assistant connections into `connections`. */

    async loadConnections(): Promise<void> {
      this.connectionsError = null
      this.connectionsLoading = true
      try {
        const response = await requestJSON<unknown>({ path: '/account/mcp_connections' })
        this.connections = mcpConnectionsFromJSON(loadAPIResponseBodyOrThrowErrors(response))
      } catch (error) {
        this.connectionsError = anythingToError(error)
        notifySentry(error)
      } finally {
        this.connectionsLoading = false
      }
    },

    /**
     * Revokes a connection's access immediately and removes it from `connections`.
     *
     * @param connection The connection to revoke.
     * @throws If an HTTP error occurs.
     */

    async revoke(connection: McpConnection): Promise<void> {
      this.revokingID = connection.id
      try {
        const response = await request({
          method: 'delete',
          path: `/account/mcp_connections/${String(connection.id)}`,
        })
        ignoreResponseBody(response)
        if (this.connections) {
          this.connections.connections = this.connections.connections.filter(
            ({ id }) => id !== connection.id,
          )
        }
      } finally {
        this.revokingID = null
      }
    },
  },
})
