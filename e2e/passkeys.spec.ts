import { test, expect } from './fixtures'
import { ADMIN, APEX_URL, logInOnApex, PASSWORD } from './helpers'

// Passkey registration and login, driven by Chromium's CDP virtual
// authenticator (ctap2, internal transport, user verification on). The
// backend's WebAuthn RP is the apex host, so both ceremonies run there.

// WebAuthn only exists in secure contexts, and lvh.me (unlike localhost)
// isn't one over plain HTTP — so have Chromium treat the apex as secure.
// The default chrome-headless-shell ignores the flag; the full Chromium
// build (new headless mode) honors it.
test.use({
  channel: 'chromium',
  launchOptions: {
    args: ['--unsafely-treat-insecure-origin-as-secure=http://lvh.me:4173'],
  },
})

test.describe('Passkeys: register on /account, then passwordless login', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'The CDP virtual authenticator is Chromium-only.')
  })

  test('registers a passkey and logs in with it after logging out', async ({
    page,
    resetDatabase: _reset,
  }) => {
    const client = await page.context().newCDPSession(page)
    await client.send('WebAuthn.enable')
    await client.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    })

    // ── Register the passkey (Rodauth requires the password) ─────────────
    await logInOnApex(page, ADMIN.email)
    await page.goto(`${APEX_URL}/account`)
    await page.getByTestId('passkey-new-label').fill('Virtual authenticator')
    await page.getByTestId('passkey-new-password').fill(PASSWORD)
    await page.getByTestId('passkey-add').click()
    await expect(page.getByTestId('passkeys-success')).toBeVisible()
    await expect(page.getByTestId('passkey-label')).toHaveText('Virtual authenticator')

    // ── Log out, then back in with the passkey alone ─────────────────────
    await page.getByTestId('current-user-email').click()
    await page.getByTestId('logout-button').click()
    await page.waitForURL('**/login')

    // The login view starts a conditional-UI (autofill) ceremony on mount,
    // which the virtual authenticator may auto-complete; otherwise the
    // explicit button runs the modal ceremony. Either path lands on /groups.
    await Promise.race([
      page.waitForURL(`${APEX_URL}/groups`),
      page
        .getByTestId('login-passkey')
        .click()
        .catch(() => undefined),
    ])
    await page.waitForURL(`${APEX_URL}/groups`)
    await expect(page.getByTestId('current-user-email')).toContainText(ADMIN.email)
  })
})
