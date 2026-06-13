import { z } from 'zod'
import type {
  Balance,
  Group,
  GroupPreview,
  Invitation,
  InvitationPreview,
  Market,
  MarketDetail,
  Member,
  NotificationPreferences,
  Passkey,
  PaymentMethod,
  Position,
  Settlement,
  SettleUpTransfer,
  User,
} from '@/types'
import { matchLocale, type SupportedLocale } from '@/i18n/locales'

const passkeySchema = z.object({
  id: z.string(),
  label: z.string().nullable(),
  last_used_at: z.string().nullable(),
})

const userSchema = z.object({
  email: z.string().optional(),
  name: z.string(),
  locale: z.string().nullish(),
  venmo_handle: z.string().nullish(),
  paypal_handle: z.string().nullish(),
  cashapp_cashtag: z.string().nullish(),
  passkeys: z.array(passkeySchema).optional(),
  notification_preferences: z
    .record(z.string(), z.object({ email: z.boolean().optional(), push: z.boolean().optional() }))
    .optional(),
  vapid_public_key: z.string().nullish(),
})

/** Shape of user profile JSON data sent from the frontend to the back-end. */
export interface UserJSONUp {
  name: string
  email: string
  locale: SupportedLocale
  venmo_handle: string | null
  paypal_handle: string | null
  cashapp_cashtag: string | null
  notification_preferences?: NotificationPreferences
}

/** Shape of passkey JSON data received from the back-end. */
export interface PasskeyJSONDown {
  id: string
  label: string | null
  last_used_at: string | null
}

/** Shape of user JSON data received from the back-end (login and account responses). */
export interface UserJSONDown {
  name: string
  email: string
  locale: string | null
  venmo_handle: string | null
  paypal_handle: string | null
  cashapp_cashtag: string | null
  passkeys: PasskeyJSONDown[]
  access_token?: string
  refresh_token?: string
  notification_preferences?: NotificationPreferences
  vapid_public_key?: string | null
}

/**
 * Converts received user JSON to a {@link User}.
 *
 * @param data The JSON data received.
 * @returns The User object.
 */
export function userFromJSON(data: unknown): User {
  const JSON = userSchema.parse(data)
  return {
    email: JSON.email,
    name: JSON.name,
    locale: JSON.locale ? matchLocale(JSON.locale) : null,
    venmoHandle: JSON.venmo_handle ?? null,
    paypalHandle: JSON.paypal_handle ?? null,
    cashappCashtag: JSON.cashapp_cashtag ?? null,
    passkeys: JSON.passkeys?.map(passkeyFromJSON) ?? [],
    notificationPreferences: JSON.notification_preferences ?? {},
    vapidPublicKey: JSON.vapid_public_key ?? null,
  }
}

/**
 * Converts received passkey JSON to a {@link Passkey}.
 *
 * @param data The JSON data received.
 * @returns The Passkey object.
 */
export function passkeyFromJSON(data: PasskeyJSONDown): Passkey {
  return {
    id: data.id,
    label: data.label,
    lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : null,
  }
}

const groupSchema = z.object({
  name: z.string(),
  subdomain: z.string(),
  currency: z.string(),
  min_amount_cents: z.number(),
  max_amount_cents: z.number(),
  status: z.enum(['active', 'suspended']),
  membership: z
    .object({
      id: z.number(),
      role: z.enum(['member', 'admin']),
    })
    .nullish(),
})

const availabilitySchema = z.object({
  subdomain: z.string(),
  available: z.boolean(),
})

/** Shape of group attributes sent from the frontend to the back-end on creation. */
export interface GroupJSONUp {
  name: string
  subdomain: string
  currency: string
  min_amount_cents?: number
  max_amount_cents?: number
}

/** Shape of group settings sent from the frontend to the back-end on update. */
export interface GroupSettingsJSONUp {
  name: string
  min_amount_cents: number
  max_amount_cents: number
}

/**
 * Converts received group JSON to a {@link Group}.
 *
 * @param data The JSON data received.
 * @returns The Group object.
 */
export function groupFromJSON(data: unknown): Group {
  const JSON = groupSchema.parse(data)
  return {
    name: JSON.name,
    subdomain: JSON.subdomain,
    currency: JSON.currency,
    minAmountCents: JSON.min_amount_cents,
    maxAmountCents: JSON.max_amount_cents,
    status: JSON.status,
    membership: JSON.membership ?? null,
  }
}

/**
 * Parses a subdomain-availability response.
 *
 * @param data The JSON data received from `GET /groups/availability`.
 * @returns Whether the subdomain is available.
 */
export function availabilityFromJSON(data: unknown): boolean {
  return availabilitySchema.parse(data).available
}

const groupPreviewSchema = z.object({
  name: z.string(),
  subdomain: z.string(),
  member_count: z.number(),
  join_requested: z.boolean(),
})

/**
 * The two shapes `GET /groups/:slug` can take: members receive the full group (settings plus
 * their own membership); other authenticated users receive a minimal preview for the join page.
 */
export type GroupShow = { member: true; group: Group } | { member: false; preview: GroupPreview }

/**
 * Converts a group show response to either a full {@link Group} (member view) or a
 * {@link GroupPreview} (non-member view), discriminated by the presence of `member_count`,
 * which only the minimal serializer includes.
 *
 * @param data The JSON data received from `GET /groups/:slug`.
 * @returns The parsed member or non-member representation.
 */
export function groupShowFromJSON(data: unknown): GroupShow {
  const parsed = z.union([groupSchema, groupPreviewSchema]).parse(data)
  if ('member_count' in parsed) {
    return {
      member: false,
      preview: {
        name: parsed.name,
        subdomain: parsed.subdomain,
        memberCount: parsed.member_count,
        joinRequested: parsed.join_requested,
      },
    }
  }
  return { member: true, group: groupFromJSON(parsed) }
}

const memberRefSchema = z.object({
  id: z.number(),
  name: z.string(),
})

const memberSchema = z.object({
  id: z.number(),
  role: z.enum(['member', 'admin']),
  user: z.object({ id: z.number(), name: z.string() }),
})

/**
 * Converts received membership JSON (a group roster row) to a {@link Member}.
 *
 * @param data The JSON data received.
 * @returns The Member object.
 */
export function memberFromJSON(data: unknown): Member {
  return memberSchema.parse(data)
}

const outcomeSchema = z.object({
  id: z.number(),
  name: z.string(),
  position: z.number(),
  pool_cents: z.number().int(),
  position_count: z.number().int(),
})

const myPositionSchema = z.object({
  id: z.number(),
  outcome_id: z.number(),
  amount_cents: z.number().int(),
})

const positionSchema = z.object({
  id: z.number(),
  outcome_id: z.number(),
  amount_cents: z.number().int(),
  updated_at: z.string(),
  member: memberRefSchema,
})

const marketSchema = z.object({
  id: z.number(),
  title: z.string(),
  status: z.enum(['open', 'resolved', 'voided']),
  locked: z.boolean(),
  locks_at: z.string(),
  created_at: z.string(),
  currency: z.string(),
  creator: memberRefSchema,
  oracle: memberRefSchema,
  outcomes: z.array(outcomeSchema),
  total_pool_cents: z.number().int(),
  my_position: myPositionSchema.nullish(),
  // Arrives with the Phase 4 resolution serializers; tolerated as absent until then.
  winning_outcome_id: z.number().nullish(),
})

const payoutSchema = z.object({
  membership_id: z.number(),
  name: z.string(),
  net_cents: z.number().int(),
})

const marketEventSchema = z.object({
  action: z.enum(['resolved', 'voided', 'corrected']),
  actor_name: z.string(),
  outcome_name: z.string().nullish(),
  created_at: z.string(),
})

const commentSchema = z.object({
  id: z.number(),
  body: z.string(),
  created_at: z.string(),
  author: memberRefSchema,
})

const marketDetailSchema = marketSchema.extend({
  description: z.string().nullish(),
  positions: z.array(positionSchema),
  comments: z.array(commentSchema),
  resolved_by: memberRefSchema.nullish(),
  payouts: z.array(payoutSchema),
  events: z.array(marketEventSchema),
})

type MarketJSONDown = z.infer<typeof marketSchema>

function marketFromParsed(parsed: MarketJSONDown): Market {
  return {
    id: parsed.id,
    title: parsed.title,
    status: parsed.status,
    locked: parsed.locked,
    locksAt: new Date(parsed.locks_at),
    createdAt: new Date(parsed.created_at),
    currency: parsed.currency,
    creator: parsed.creator,
    oracle: parsed.oracle,
    outcomes: parsed.outcomes.map((outcome) => ({
      id: outcome.id,
      name: outcome.name,
      position: outcome.position,
      poolCents: outcome.pool_cents,
      positionCount: outcome.position_count,
    })),
    totalPoolCents: parsed.total_pool_cents,
    myPosition: parsed.my_position
      ? {
          id: parsed.my_position.id,
          outcomeId: parsed.my_position.outcome_id,
          amountCents: parsed.my_position.amount_cents,
        }
      : null,
    winningOutcomeId: parsed.winning_outcome_id ?? null,
  }
}

/**
 * Converts received market JSON (a feed list item) to a {@link Market}.
 *
 * @param data The JSON data received.
 * @returns The Market object.
 */
export function marketFromJSON(data: unknown): Market {
  return marketFromParsed(marketSchema.parse(data))
}

/**
 * Converts received market detail JSON to a {@link MarketDetail}.
 *
 * @param data The JSON data received.
 * @returns The MarketDetail object.
 */
export function marketDetailFromJSON(data: unknown): MarketDetail {
  const parsed = marketDetailSchema.parse(data)
  return {
    ...marketFromParsed(parsed),
    description: parsed.description ?? null,
    positions: parsed.positions.map(positionFromParsed),
    comments: parsed.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      author: comment.author,
      createdAt: new Date(comment.created_at),
    })),
    resolvedBy: parsed.resolved_by ?? null,
    payouts: parsed.payouts.map((payout) => ({
      membershipId: payout.membership_id,
      name: payout.name,
      netCents: payout.net_cents,
    })),
    events: parsed.events.map((event) => ({
      action: event.action,
      actorName: event.actor_name,
      outcomeName: event.outcome_name ?? null,
      createdAt: new Date(event.created_at),
    })),
  }
}

function positionFromParsed(parsed: z.infer<typeof positionSchema>): Position {
  return {
    id: parsed.id,
    outcomeId: parsed.outcome_id,
    amountCents: parsed.amount_cents,
    updatedAt: new Date(parsed.updated_at),
    member: parsed.member,
  }
}

/** Shape of market attributes sent from the frontend to the back-end on creation. */
export interface MarketJSONUp {
  title: string
  description: string
  locks_at: string
  outcomes: string[]
  oracle_id?: number
}

/**
 * Shape of market attributes sent from the frontend to the back-end on update. `locks_at` is
 * editable while the market is open; the backend emails position holders about changes.
 */
export interface MarketUpdateJSONUp {
  title: string
  description: string
  locks_at?: string
}

/** Shape of position attributes sent from the frontend to the back-end on upsert. */
export interface PositionJSONUp {
  outcome_id: number
  amount_cents: number
}

/** Shape of comment attributes sent from the frontend to the back-end on creation. */
export interface CommentJSONUp {
  body: string
}

const balancesSchema = z.object({
  currency: z.string(),
  balances: z.array(
    z.object({
      membership_id: z.number(),
      name: z.string(),
      balance_cents: z.number().int(),
    }),
  ),
})

/**
 * Parses a balances response into the group's per-member {@link Balance} list.
 *
 * @param data The JSON data received from `GET /balances`.
 * @returns The balances, largest creditors first.
 */
export function balancesFromJSON(data: unknown): Balance[] {
  return balancesSchema.parse(data).balances.map((balance) => ({
    membershipId: balance.membership_id,
    name: balance.name,
    balanceCents: balance.balance_cents,
  }))
}

const settleUpSchema = z.object({
  currency: z.string(),
  note: z.string(),
  transfers: z.array(
    z.object({
      payer_membership_id: z.number(),
      payee_membership_id: z.number(),
      amount_cents: z.number().int(),
      payee: z.object({
        membership_id: z.number(),
        name: z.string(),
        venmo_handle: z.string().nullish(),
        paypal_handle: z.string().nullish(),
        cashapp_cashtag: z.string().nullish(),
      }),
    }),
  ),
})

/** The settle-up suggestions: the payment note plus the transfers that zero all balances. */
export interface SettleUp {
  note: string
  transfers: SettleUpTransfer[]
}

/**
 * Parses a settle-up response.
 *
 * @param data The JSON data received from `GET /settle_up`.
 * @returns The payment note and suggested transfers.
 */
export function settleUpFromJSON(data: unknown): SettleUp {
  const parsed = settleUpSchema.parse(data)
  return {
    note: parsed.note,
    transfers: parsed.transfers.map((transfer) => ({
      payerMembershipId: transfer.payer_membership_id,
      payeeMembershipId: transfer.payee_membership_id,
      amountCents: transfer.amount_cents,
      payee: {
        membershipId: transfer.payee.membership_id,
        name: transfer.payee.name,
        venmoHandle: transfer.payee.venmo_handle ?? null,
        paypalHandle: transfer.payee.paypal_handle ?? null,
        cashappCashtag: transfer.payee.cashapp_cashtag ?? null,
      },
    })),
  }
}

const paymentMethodSchema = z.enum(['venmo', 'paypal', 'cashapp', 'cash', 'other'])

const settlementSchema = z.object({
  id: z.number(),
  amount_cents: z.number().int(),
  currency: z.string(),
  payment_method: paymentMethodSchema,
  note: z.string().nullish(),
  voided: z.boolean(),
  created_at: z.string(),
  payer: memberRefSchema,
  payee: memberRefSchema,
  recorded_by: memberRefSchema,
})

/**
 * Converts received settlement JSON to a {@link Settlement}.
 *
 * @param data The JSON data received.
 * @returns The Settlement object.
 */
export function settlementFromJSON(data: unknown): Settlement {
  const parsed = settlementSchema.parse(data)
  return {
    id: parsed.id,
    amountCents: parsed.amount_cents,
    currency: parsed.currency,
    paymentMethod: parsed.payment_method,
    note: parsed.note ?? null,
    voided: parsed.voided,
    createdAt: new Date(parsed.created_at),
    payer: parsed.payer,
    payee: parsed.payee,
    recordedBy: parsed.recorded_by,
  }
}

/** Shape of settlement attributes sent from the frontend to the back-end on creation. */
export interface SettlementJSONUp {
  payee_membership_id: number
  amount_cents: number
  payment_method: PaymentMethod
  payer_membership_id?: number
  note?: string
}

const invitationSchema = z.object({
  id: z.number(),
  email: z.string(),
  role: z.enum(['member', 'admin']),
  expires_at: z.string(),
  created_at: z.string(),
})

/**
 * Converts received invitation JSON to an {@link Invitation}.
 *
 * @param data The JSON data received.
 * @returns The Invitation object.
 */
export function invitationFromJSON(data: unknown): Invitation {
  const parsed = invitationSchema.parse(data)
  return {
    id: parsed.id,
    email: parsed.email,
    role: parsed.role,
    expiresAt: new Date(parsed.expires_at),
    createdAt: new Date(parsed.created_at),
  }
}

/** Shape of invitation attributes sent from the frontend to the back-end on creation. */
export interface InvitationJSONUp {
  email: string
  role: 'member' | 'admin'
}

const invitationPreviewSchema = z.object({
  email: z.string(),
  role: z.enum(['member', 'admin']),
  group_name: z.string(),
  inviter_name: z.string(),
  valid: z.boolean(),
})

/**
 * Converts a received invitation preview (what an invitee sees before accepting) to an
 * {@link InvitationPreview}.
 *
 * @param data The JSON data received from `GET /invitations/:token`.
 * @returns The InvitationPreview object.
 */
export function invitationPreviewFromJSON(data: unknown): InvitationPreview {
  const parsed = invitationPreviewSchema.parse(data)
  return {
    email: parsed.email,
    role: parsed.role,
    groupName: parsed.group_name,
    inviterName: parsed.inviter_name,
    valid: parsed.valid,
  }
}

/** Credentials sent to the `logIn` action. */
export interface SessionJSONUp {
  login: string
  password: string
  turnstile_token: string
}

/** Payload sent to the `signUp` action. */
export interface SignUpJSONUp {
  login: string
  password: string
  name: string
  locale: SupportedLocale
  turnstile_token: string
}

/** Payload sent to the `forgotPassword` action. */
export interface ForgotPasswordJSONUp {
  login: string
  turnstile_token: string
}

/** Payload sent to the `verifyAccount` action. */
export interface VerifyAccountJSONUp {
  key: string
}
