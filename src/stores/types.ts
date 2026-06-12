import type { Result } from 'ts-results'
import type {
  Balance,
  Group,
  GroupPreview,
  Invitation,
  Market,
  MarketDetail,
  Member,
  Settlement,
  SettleUpTransfer,
  User,
} from '@/types'

/**
 * The shape of validation errors received from the back-end. A dictionary mapping field names to a
 * list of their errors.
 */
export type Errors = Record<string, string[]>

/**
 * A store-friendly error type that avoids the `cause` property on the native `Error` type.
 * Pinia 3.x `_DeepPartial` cannot reconcile `Error.cause` (`unknown`) with
 * `_DeepPartial<unknown> | undefined`, so we use this narrower type in store state interfaces
 * while still being assignable from real `Error` instances.
 */
export interface StoreError {
  name: string
  message: string
  stack?: string
}

export interface AccountState {
  currentUser: User | null
  currentUserLoading: boolean
  currentUserError: StoreError | null
}

export interface GroupsState {
  myGroups: Group[] | null
  myGroupsLoading: boolean
  myGroupsError: StoreError | null
}

export interface GroupState {
  /** The current group in full, when the viewer is an active member. */
  group: Group | null

  /** The minimal preview, when the viewer is not a member (authenticated or logged out). */
  groupPreview: GroupPreview | null

  groupLoading: boolean

  /** Whether the subdomain matches no active group (404). */
  groupNotFound: boolean

  groupError: StoreError | null
}

export interface MarketsState {
  markets: Market[] | null
  marketsLoading: boolean
  marketsError: StoreError | null
}

export interface MarketState {
  market: MarketDetail | null
  marketLoading: boolean

  /** Whether the requested market doesn't exist in this group (404). */
  marketNotFound: boolean

  marketError: StoreError | null
}

export interface MembersState {
  members: Member[] | null
  membersLoading: boolean
  membersError: StoreError | null

  /** Pending join requests (admins only; stays `null` for non-admins). */
  joinRequests: Member[] | null
  joinRequestsLoading: boolean
  joinRequestsError: StoreError | null

  /** Pending email invitations (admins only; stays `null` for non-admins). */
  invitations: Invitation[] | null
  invitationsLoading: boolean
  invitationsError: StoreError | null
}

export interface SettlementState {
  /** Every active member's realized balance, largest creditors first. */
  balances: Balance[] | null
  balancesLoading: boolean
  balancesError: StoreError | null

  /** The note to attach to settle-up payments. */
  settleUpNote: string | null

  /** The suggested transfers that zero all balances. */
  transfers: SettleUpTransfer[] | null
  transfersLoading: boolean
  transfersError: StoreError | null

  /** The group's recent settlements, voided ones included, newest first. */
  settlements: Settlement[] | null
  settlementsLoading: boolean
  settlementsError: StoreError | null
}

export interface AuthState {
  JWT: string | null
  refreshToken: string | null
  loggingIn: boolean
}

export interface APISuccess<T> {
  response: Response
  body?: T
}

export interface APIFailure {
  response: Response
  body: { errors?: Errors; error?: string }
}

export type APIResponse<T> = Result<APISuccess<T>, APIFailure>
