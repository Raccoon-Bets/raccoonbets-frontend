import { defineStore } from 'pinia'
import { Err, Ok, type Result } from 'ts-results'
import type { AccountState, APIResponse, Errors } from '@/stores/types'
import {
  userFromJSON,
  type ForgotPasswordJSONUp,
  type SignUpJSONUp,
  type UserJSONDown,
  type UserJSONUp,
  type VerifyAccountJSONUp,
} from '@/stores/coding'
import type { NotificationPreferences, User } from '@/types'
import { request, requestJSON } from '@/stores/modules/root'
import {
  anythingToError,
  ignoreAPIResponseBodyOrReturnErrors,
  ignoreResponseBody,
  loadAPIResponseBodyOrReturnErrors,
  loadAPIResponseBodyOrThrowErrors,
} from '@/stores/utils'
import { notifySentry } from '@/utils/errors'
import { applyLocale } from '@/i18n'
import { useAuthStore } from '@/stores/modules/auth'

const initialState: AccountState = {
  currentUser: null,
  currentUserLoading: false,
  currentUserError: null,
}

export const useAccountStore = defineStore('account', {
  state: () => ({ ...initialState }),
  actions: {
    reset(): void {
      this.$patch(initialState)
    },

    setCurrentUser(user: User): void {
      this.$patch({
        currentUser: user,
        currentUserError: null,
        currentUserLoading: false,
      })
      // Once authenticated, the account's saved language is the source of truth.
      if (user.locale) applyLocale(user.locale)
    },

    /**
     * Creates a new user. With Rodauth `:verify_account` enabled, the response
     * carries no tokens or user data — the user must click an emailed link
     * before they can log in.
     *
     * @param signUp The signup attributes (login, password, name, locale).
     * @throws If an HTTP error occurs.
     */

    async signUp(signUp: SignUpJSONUp): Promise<Result<void, Errors>> {
      const auth = useAuthStore()

      auth.reset()

      try {
        const response: APIResponse<unknown> = await requestJSON({
          method: 'post',
          path: '/signup',
          body: { ...signUp },
          unauthenticated: true,
          skipResetAuth: true,
        })
        const result = ignoreAPIResponseBodyOrReturnErrors(response)
        if (result.ok) return Ok.EMPTY
        return new Err(result.val)
      } catch (error) {
        this.reset()
        auth.reset()
        throw error
      }
    },

    /**
     * Verifies a newly-created user account using a key from the verification
     * email.
     *
     * @param key The verification key from the email link.
     * @returns A Result containing nothing if successful, or the validation
     * errors if failed.
     * @throws If an HTTP error occurs.
     */

    async verifyAccount(key: string): Promise<Result<void, Errors>> {
      const body: VerifyAccountJSONUp = { key }
      const response: APIResponse<unknown> = await requestJSON({
        method: 'post',
        path: '/verify-account',
        body: { ...body },
        unauthenticated: true,
        skipResetAuth: true,
      })
      return ignoreAPIResponseBodyOrReturnErrors(response)
    },

    /**
     * Generates a reset-password email.
     *
     * @param payload The user email address and Turnstile token.
     * @throws If an HTTP error occurs.
     */

    async forgotPassword(payload: ForgotPasswordJSONUp): Promise<void> {
      const response = await request({
        method: 'post',
        path: '/password-resets',
        body: { ...payload },
      })
      ignoreResponseBody(response)
    },

    /**
     * Resets a user password using a token from a reset-password email.
     *
     * @param password The new user password.
     * @param token The token from the reset-password email.
     * @returns A Result containing nothing if successful, or the validation errors
     * if failed.
     * @throws If an HTTP error occurs.
     */

    async resetPassword({
      password,
      token,
    }: {
      password: string
      token: string
    }): Promise<Result<void, Errors>> {
      const response: APIResponse<void> = await requestJSON({
        method: 'post',
        path: '/reset-password',
        body: { key: token, password },
        unauthenticated: true,
        skipResetAuth: true,
      })
      return ignoreAPIResponseBodyOrReturnErrors(response)
    },

    /**
     * Loads the current user account to `currentUser`. Does nothing if not
     * logged in.
     *
     * @throws If an HTTP error occurs.
     */

    async loadAccount(): Promise<void> {
      const auth = useAuthStore()

      if (!auth.loggedIn) return

      this.$patch({
        currentUser: null,
        currentUserError: null,
        currentUserLoading: true,
      })
      try {
        const response = await requestJSON<UserJSONDown>({
          method: 'GET',
          path: '/account',
        })
        if (response.ok) {
          const body = loadAPIResponseBodyOrThrowErrors(response)
          this.setCurrentUser(userFromJSON(body))
        }
      } catch (error) {
        this.$patch({
          currentUser: null,
          currentUserLoading: false,
          currentUserError: anythingToError(error),
        })
        notifySentry(error)
      }
    },

    /**
     * Updates the User's profile (name, email, payment handles).
     *
     * @param user The new user attributes.
     * @returns A Result containing nothing if successful, or the validation errors
     * if failed.
     * @throws If an HTTP error occurs.
     */

    async updateAccount(user: UserJSONUp): Promise<Result<void, Errors>> {
      const response = await requestJSON<UserJSONDown>({
        method: 'PATCH',
        path: '/account',
        body: { user },
      })
      const result = loadAPIResponseBodyOrReturnErrors(response)
      if (result.ok) {
        this.setCurrentUser(userFromJSON(result.val))
        return Ok.EMPTY
      }
      return new Err(result.val)
    },

    /**
     * Updates only the user's notification preferences.
     *
     * @param preferences The new per-event channel toggles.
     */
    async updateNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
      const response = await requestJSON<UserJSONDown>({
        method: 'PATCH',
        path: '/account',
        body: { user: { notification_preferences: preferences } },
      })
      if (response.ok) {
        this.setCurrentUser(userFromJSON(loadAPIResponseBodyOrThrowErrors(response)))
      }
    },

    /**
     * Deletes the current User account.
     */

    async deleteAccount(): Promise<void> {
      const auth = useAuthStore()

      const response: Response = await request({
        method: 'delete',
        path: '/account',
      })
      ignoreResponseBody(response)
      this.reset()
      auth.reset()
    },
  },
})
