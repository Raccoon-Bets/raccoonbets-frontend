import type { SupportedLocale } from '@/i18n/locales'

/** The notifiable event keys, matching the backend. */
export type NotificationEvent =
  | 'market_resolved'
  | 'market_created'
  | 'settlement'
  | 'market_closing_soon'

/** A per-event pair of channel toggles. */
export interface ChannelToggles {
  email: boolean
  push: boolean
}

/** A user's per-event notification preferences (partial; missing keys default ON). */
export type NotificationPreferences = Partial<Record<NotificationEvent, Partial<ChannelToggles>>>

/** A WebAuthn passkey registered to the current user. */
export interface Passkey {
  /** The credential's WebAuthn ID. */
  id: string

  /** An optional user-supplied label. */
  label: string | null

  /** When the passkey was last used to log in, if ever. */
  lastUsedAt: Date | null
}

/** The current user's role and membership in a {@link Group}. */
export interface GroupMembership {
  /** The membership's ID. */
  id: number

  /** The user's role within the group. */
  role: 'member' | 'admin'
}

/** A trading group (a "den") living on its own subdomain. */
export interface Group {
  /** The display name of the group. */
  name: string

  /** The group's subdomain slug. */
  subdomain: string

  /** The ISO 4217 code all the group's amounts are denominated in. */
  currency: string

  /** The smallest allowed amount, in minor units of `currency`. */
  minAmountCents: number

  /** The largest allowed amount, in minor units of `currency`. */
  maxAmountCents: number

  /** Whether the group is active or suspended by a superadmin. */
  status: 'active' | 'suspended'

  /** The current user's membership, when the response includes it. */
  membership: GroupMembership | null
}

/** A minimal group preview shown to non-members — including logged-out visitors (the join page). */
export interface GroupPreview {
  /** The display name of the group. */
  name: string

  /** The group's subdomain slug. */
  subdomain: string

  /** How many active members the group has. */
  memberCount: number

  /** Whether the viewer already has a pending join request. */
  joinRequested: boolean
}

/** A lightweight reference to a group member: a membership ID and display name. */
export interface MemberRef {
  /** The membership's ID. */
  id: number

  /** The member's display name. */
  name: string
}

/** An active member in the group roster. */
export interface Member {
  /** The membership's ID. */
  id: number

  /** The member's role within the group. */
  role: 'member' | 'admin'

  /** The member's user, with a display name. */
  user: { id: number; name: string }
}

/** One possible result of a {@link Market}, with its parimutuel pool totals. */
export interface Outcome {
  /** The outcome's ID. */
  id: number

  /** The outcome's label (e.g. `YES`). */
  name: string

  /** The outcome's display order within the market. */
  position: number

  /** The total staked on this outcome, in minor units of the group's currency. */
  poolCents: number

  /** How many positions ride on this outcome. */
  positionCount: number
}

/** The viewing member's own position on a {@link Market}. */
export interface MyPosition {
  /** The position's ID. */
  id: number

  /** The ID of the backed {@link Outcome}. */
  outcomeId: number

  /** The amount, in minor units of the group's currency. */
  amountCents: number
}

/** Any member's position on a {@link Market}, as listed on the market detail screen. */
export interface Position {
  /** The position's ID. */
  id: number

  /** The ID of the backed {@link Outcome}. */
  outcomeId: number

  /** The amount, in minor units of the group's currency. */
  amountCents: number

  /** When the position was last placed or changed. */
  updatedAt: Date

  /** The member who placed the position. */
  member: MemberRef
}

/** A proposition the group trades on, as it appears in the feed. */
export interface Market {
  /** The market's ID. */
  id: number

  /** The proposition, phrased as a question. */
  title: string

  /** The market's lifecycle status. `locked` is derived from {@link locksAt}, not a status. */
  status: 'open' | 'resolved' | 'voided'

  /** Whether trading has closed because {@link locksAt} passed while the market is still open. */
  locked: boolean

  /** When trading closes. */
  locksAt: Date

  /** When the market was created. */
  createdAt: Date

  /** The ISO 4217 code the market's amounts are denominated in. */
  currency: string

  /** The member who created the market. */
  creator: MemberRef

  /** The member designated to resolve the market. */
  oracle: MemberRef

  /** The outcomes members can trade on, with pool totals, ordered by position. */
  outcomes: Outcome[]

  /** The total staked across all outcomes, in minor units of {@link currency}. */
  totalPoolCents: number

  /** The viewing member's own position, if any. */
  myPosition: MyPosition | null

  /** The ID of the winning {@link Outcome} once the market is resolved, if the API provides it. */
  winningOutcomeId: number | null
}

/** One member's net result from a resolved {@link Market}'s ledger entries. */
export interface Payout {
  /** The member's membership ID. */
  membershipId: number

  /** The member's display name. */
  name: string

  /** The member's net winnings (positive) or losses (negative), in minor units. */
  netCents: number
}

/** One entry in a {@link Market}'s resolution audit trail. */
export interface MarketEvent {
  /** What happened: `resolved`, `voided`, or `corrected`. */
  action: 'resolved' | 'voided' | 'corrected'

  /** The display name of the member who performed the action. */
  actorName: string

  /** The winning outcome's name, for resolutions and corrections. */
  outcomeName: string | null

  /** When the action happened. */
  createdAt: Date
}

/** A {@link Market} in full: the feed representation plus its description and every position. */
export interface MarketDetail extends Market {
  /** Optional resolution criteria and context. */
  description: string | null

  /** Every position on the market, with member names. */
  positions: Position[]

  /** The member who resolved or voided the market, if it has been. */
  resolvedBy: MemberRef | null

  /** Per-member net payouts from the market's ledger entries, largest winners first. */
  payouts: Payout[]

  /** The resolution audit trail, oldest first. */
  events: MarketEvent[]
}

/** One member's realized ledger balance. */
export interface Balance {
  /** The member's membership ID. */
  membershipId: number

  /** The member's display name. */
  name: string

  /** The balance in minor units; negative means the member owes the group. */
  balanceCents: number
}

/** A suggested transfer that helps zero the group's balances. */
export interface SettleUpTransfer {
  /** The paying member's membership ID. */
  payerMembershipId: number

  /** The receiving member's membership ID. */
  payeeMembershipId: number

  /** The amount to pay, in minor units. */
  amountCents: number

  /** The payee's name and payment handles, for building deep links. */
  payee: {
    membershipId: number
    name: string
    venmoHandle: string | null
    paypalHandle: string | null
    cashappCashtag: string | null
  }
}

/** How a {@link Settlement} was paid. */
export type PaymentMethod = 'venmo' | 'paypal' | 'cashapp' | 'cash' | 'other'

/** A recorded out-of-band payment between two members. */
export interface Settlement {
  /** The settlement's ID. */
  id: number

  /** The amount paid, in minor units of `currency`. */
  amountCents: number

  /** The ISO 4217 code the amount is denominated in. */
  currency: string

  /** How the payment was made. */
  paymentMethod: PaymentMethod

  /** An optional free-text note. */
  note: string | null

  /** Whether the settlement has been voided (reversed, never deleted). */
  voided: boolean

  /** When the settlement was recorded. */
  createdAt: Date

  /** The member who paid. */
  payer: MemberRef

  /** The member who was paid. */
  payee: MemberRef

  /** The member who recorded the settlement. */
  recordedBy: MemberRef
}

/** A pending email invitation to join the group. */
export interface Invitation {
  /** The invitation's ID. */
  id: number

  /** The invitee's email address. */
  email: string

  /** The role the invitee will receive on acceptance. */
  role: 'member' | 'admin'

  /** When the invitation expires. */
  expiresAt: Date

  /** When the invitation was sent. */
  createdAt: Date
}

/** What an invitee sees when previewing an emailed invitation link before accepting it. */
export interface InvitationPreview {
  /** The invitee's email address. */
  email: string

  /** The role the invitee will receive on acceptance. */
  role: 'member' | 'admin'

  /** The name of the group being invited into. */
  groupName: string

  /** The name of the admin who sent the invitation. */
  inviterName: string

  /** Whether the invitation can still be accepted. */
  valid: boolean
}

/** The current user's account. */
export interface User {
  /** The user's email address. */
  email?: string

  /** The user's display name. */
  name: string

  /** The user's preferred locale, when it matches a supported locale. */
  locale: SupportedLocale | null

  /** The user's Venmo handle (without `@`), for settle-up deep links. */
  venmoHandle: string | null

  /** The user's PayPal.me handle, for settle-up deep links. */
  paypalHandle: string | null

  /** The user's Cash App cashtag (without `$`), for settle-up deep links. */
  cashappCashtag: string | null

  /** The user's registered passkeys. */
  passkeys: Passkey[]

  /** Per-event email/push notification preferences. */
  notificationPreferences: NotificationPreferences

  /** The server's VAPID public key for push subscription, when available. */
  vapidPublicKey: string | null
}
