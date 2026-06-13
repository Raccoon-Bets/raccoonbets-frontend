import { defineStore } from 'pinia'
import { z } from 'zod'
import { Err, Ok, type Result } from 'ts-results'
import { Consumer, createConsumer } from '@rails/actioncable'
import type { APIResponse, AuthState, Errors } from '@/stores/types'
import config from '@/config'
import { userFromJSON, type SessionJSONUp, type UserJSONDown } from '@/stores/coding'
import { request, requestJSON } from '@/stores/modules/root'
import { ignoreResponseBody, loadAPIResponseBodyOrReturnErrors } from '@/stores/utils'
import { getCookie, removeCookie, setCookie } from '@/utils/cookieStorage'
import { useAccountStore } from '@/stores/modules/account'

// Token cookies are scoped to the apex domain (see cookieStorage) so a login
// on the apex survives navigation to any group subdomain and vice versa.
const JWT_COOKIE = 'rb_jwt'
const REFRESH_TOKEN_COOKIE = 'rb_refresh'

const jwtPayloadSchema = z.object({
  exp: z.union([z.string(), z.number()]).optional(),
  e: z.string(),
})

type JWTPayload = z.infer<typeof jwtPayloadSchema>

const initialState: AuthState = {
  JWT: null,
  refreshToken: null,
  loggingIn: false,
}

export const useAuthStore = defineStore('auth', {
  state: () => ({ ...initialState }),

  getters: {
    JWTPayload(state): JWTPayload | null {
      if (state.JWT === null) return null
      // A truncated or otherwise corrupt token cookie must not throw: this
      // getter backs loggedIn, currentEmail, and the cable consumer, all read
      // during boot, so a malformed cookie would otherwise hard-crash startup
      // with no way to recover. Treat anything unparseable as logged out.
      try {
        return jwtPayloadSchema.parse(JSON.parse(atob(state.JWT.split('.')[1] ?? '')))
      } catch {
        return null
      }
    },

    JWTExpiresAt(): Date | null {
      if (this.JWTPayload === null) return null
      const { exp } = this.JWTPayload
      if (typeof exp === 'number') return new Date(exp * 1000)
      if (typeof exp === 'string') return new Date(Number.parseInt(exp, 10) * 1000)
      return null
    },

    /** @returns Whether a user is logged in for this session. */
    loggedIn(state): boolean {
      if (state.JWT === null) return false
      if (this.JWTExpiresAt === null) return false
      return this.JWTExpiresAt > new Date()
    },

    /** The email of the User that's logged in, if any. */
    currentEmail(): string | null {
      const payload = this.JWTPayload
      if (payload === null) return null
      return payload.e
    },

    actionCableConsumer(state): Consumer | null {
      if (state.JWT === null) return null
      const queryString = new URLSearchParams({ jwt: state.JWT })
      const URL = `${config.actionCableURL}?${queryString.toString()}`
      return createConsumer(URL)
    },

    authHeader: (state) => (state.JWT ? `Bearer ${state.JWT}` : null),
  },

  actions: {
    reset() {
      this.$patch(initialState)
    },

    /** Hydrates the session from the shared-domain token cookies. */
    initializeFromCookies() {
      this.JWT = getCookie(JWT_COOKIE)
      this.refreshToken = getCookie(REFRESH_TOKEN_COOKIE)
    },

    /** Persists the session to the shared-domain token cookies. */
    persistToCookies() {
      if (this.JWT === null) removeCookie(JWT_COOKIE)
      else setCookie(JWT_COOKIE, this.JWT)
      if (this.refreshToken === null) removeCookie(REFRESH_TOKEN_COOKIE)
      else setCookie(REFRESH_TOKEN_COOKIE, this.refreshToken)
    },

    /**
     * Logs in a user account.
     *
     * @param session The login credentials.
     * @throws If an HTTP error occurred.
     */

    async logIn(session: SessionJSONUp): Promise<Result<void, Errors>> {
      const account = useAccountStore()

      this.loggingIn = true

      try {
        const response: APIResponse<UserJSONDown> = await requestJSON({
          path: '/login',
          method: 'post',
          body: { ...session },
          unauthenticated: true,
          skipResetAuth: true,
        })
        const result = loadAPIResponseBodyOrReturnErrors(response)
        if (result.ok) {
          this.setTokens(response.val.response, result.val)
          account.setCurrentUser(userFromJSON(result.val))
          return Ok.EMPTY
        }
        return new Err(result.val)
      } catch (error) {
        this.reset()
        account.reset()
        throw error
      } finally {
        this.loggingIn = false
      }
    },

    /**
     * Persists tokens from a login/signup response. The JWT is in the
     * Authorization header; the refresh token is in the body.
     */

    setTokens(response: Response, body: UserJSONDown): void {
      const authorization = response.headers.get('Authorization')
      const patch: Partial<AuthState> = { loggingIn: false }
      if (authorization && /^Bearer /.exec(authorization)) {
        patch.JWT = authorization.slice(7)
      } else if (body.access_token) {
        patch.JWT = body.access_token
      }
      if (body.refresh_token) patch.refreshToken = body.refresh_token
      this.$patch(patch)
    },

    /**
     * Persists tokens delivered by the OmniAuth callback redirect. Unlike
     * password login, the access token and refresh token both arrive in the
     * redirect fragment rather than the response header/body.
     *
     * @param accessToken The JWT access token.
     * @param refreshToken The refresh token.
     */

    setOAuthTokens(accessToken: string, refreshToken: string): void {
      this.$patch({ JWT: accessToken, refreshToken, loggingIn: false })
    },

    /**
     * Adopts a fresher session a sibling tab or subdomain may have written to
     * the shared cookie. Rodauth rotates its single-use refresh token on every
     * refresh, so two contexts refreshing the same token would invalidate one
     * another; before (or after failing to) spend our own token, take the
     * sibling's freshly rotated pair if the cookie now holds a different,
     * still-valid access token.
     *
     * @returns Whether an adopted session is present and unexpired.
     */

    adoptSiblingRefresh(): boolean {
      const cookieJWT = getCookie(JWT_COOKIE)
      if (cookieJWT === null || cookieJWT === this.JWT) return false
      this.$patch({ JWT: cookieJWT, refreshToken: getCookie(REFRESH_TOKEN_COOKIE) })
      return this.loggedIn
    },

    /**
     * Refreshes the access token using the stored refresh token.
     */

    async refreshAccessToken(): Promise<boolean> {
      // A sibling tab or subdomain may have already rotated the shared,
      // single-use refresh token and written the new pair to the cookie; adopt
      // it rather than spending our own (now invalid) copy.
      if (this.adoptSiblingRefresh()) return true
      if (!this.refreshToken || !this.JWT) return false

      // Rodauth's jwt-refresh route requires the current (possibly expired)
      // JWT in the Authorization header, which request() includes
      // automatically. skipRefresh stops a 401 here from recursing into
      // another refresh; skipResetAuth leaves the logout decision to the
      // caller, which resets only when this returns false.
      const response = await requestJSON<{ access_token: string; refresh_token: string }>({
        method: 'post',
        path: '/jwt-refresh',
        body: { refresh_token: this.refreshToken },
        skipResetAuth: true,
        skipRefresh: true,
      })
      // A concurrent sibling may have won the rotation while this request was in
      // flight; if the cookie now holds that fresh session, adopt it instead of
      // reporting a failure that would log this tab out.
      if (!response.ok || !response.val.body) return this.adoptSiblingRefresh()

      this.$patch({
        JWT: response.val.body.access_token,
        refreshToken: response.val.body.refresh_token,
      })
      return true
    },

    /**
     * Logs out the logged-in user.
     */

    async logOut(): Promise<void> {
      const account = useAccountStore()

      if (this.loggedIn) {
        const response = await request({
          method: 'post',
          path: '/logout',
        })
        ignoreResponseBody(response)
      }
      this.reset()
      account.reset()
    },
  },
})
