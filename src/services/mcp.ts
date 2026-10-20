import { z } from 'zod'
import { request } from '@/stores/modules/root'

const groupSchema = z.object({ id: z.number(), name: z.string() })
const consentSchema = z.object({
  client_name: z.string(),
  redirect_uri: z.url(),
  write_requested: z.boolean(),
  groups: z.array(groupSchema),
})
const connectionsSchema = z.object({
  enabled: z.boolean(),
  connections: z.array(
    z.object({
      id: z.number(),
      client_name: z.string(),
      scopes: z.array(z.string()),
      groups: z.array(groupSchema),
      expires_at: z.string(),
      revoked_at: z.string().nullable(),
    }),
  ),
})

/** Details of a pending assistant authorization, authenticated by the website session. */
export type Consent = z.infer<typeof consentSchema>
/** Assistant connections and the service's current availability. */
export type Connections = z.infer<typeof connectionsSchema>

async function checked(response: Response): Promise<unknown> {
  const body: unknown = response.status === 204 ? null : await response.json()
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(body)
    throw new Error(
      error.success ? error.data.error : `Request failed (${String(response.status)})`,
    )
  }
  return body
}

/** Loads the consent request and the member's currently selectable groups. */
export async function loadConsent(id: string): Promise<Consent> {
  return consentSchema.parse(
    await checked(await request({ path: `/oauth/requests/${encodeURIComponent(id)}` })),
  )
}

/** Approves selected groups and returns the validated OAuth callback URL. */
export async function decideConsent(
  id: string,
  groupIds: number[],
  write: boolean,
): Promise<string> {
  return submitDecision(id, { approve: true, group_ids: groupIds, write })
}

/** Denies a pending request and returns the client's cancellation callback URL. */
export async function denyConsent(id: string): Promise<string> {
  return submitDecision(id, { approve: false })
}

async function submitDecision(id: string, body: Record<string, unknown>): Promise<string> {
  const result = await checked(
    await request({
      method: 'post',
      path: `/oauth/requests/${encodeURIComponent(id)}/decision`,
      body,
    }),
  )
  return z.object({ redirect_uri: z.url() }).parse(result).redirect_uri
}

/** Lists current and historical connections without returning any tokens. */
export async function loadConnections(): Promise<Connections> {
  return connectionsSchema.parse(await checked(await request({ path: '/account/mcp_connections' })))
}

/** Revokes a connection's access and refresh credentials immediately. */
export async function revokeConnection(id: number): Promise<void> {
  await checked(await request({ method: 'delete', path: `/account/mcp_connections/${String(id)}` }))
}
