import { test, expect, fetchLastEmail, extractEmailPath } from './fixtures'
import { ADMIN, APEX_URL, logInOnApex, PASSWORD } from './helpers'

// Auth flows beyond Flow A's signup: session lifecycle (login → logout →
// protected pages bounce), bad credentials, and the full password-reset loop.

test.describe('Auth: login, logout, and password reset', () => {
  test('logs in on the apex, logs out, and protected pages redirect to login', async ({
    page,
    resetDatabase: _reset,
  }) => {
    await logInOnApex(page, ADMIN.email)
    await expect(page.getByTestId('groups-list')).toContainText('Cypress Den')

    // ── Log out via the user menu ────────────────────────────────────────
    await page.getByTestId('current-user-email').click()
    await page.getByTestId('logout-button').click()
    await page.waitForURL('**/login')

    // ── A protected page now bounces back to login ───────────────────────
    await page.goto(`${APEX_URL}/account`)
    await page.waitForURL('**/login')
  })

  test('rejects a bad password with an error and no session', async ({
    page,
    logInPage,
    resetDatabase: _reset,
  }) => {
    await logInPage.visit()
    await logInPage.logIn(ADMIN.email, 'definitely-not-it')

    await expect(page.getByTestId('login-error')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('resets a forgotten password via the emailed link', async ({
    page,
    logInPage,
    resetDatabase: _reset,
  }) => {
    const NEW_PASSWORD = 'evenmoresecret'

    // ── Request the reset link ───────────────────────────────────────────
    await page.goto(`${APEX_URL}/forgot-password`)
    await page.getByTestId('forgot-password-email').fill(ADMIN.email)
    await page.getByTestId('forgot-password-submit').click()
    await expect(page.getByTestId('forgot-password-success')).toBeVisible()

    // ── Follow the emailed link and choose a new password ────────────────
    const email = await fetchLastEmail()
    expect(email).not.toBeNull()
    await page.goto(extractEmailPath(email!, APEX_URL))
    await page.getByTestId('reset-password-password').fill(NEW_PASSWORD)
    await page.getByTestId('reset-password-password-confirmation').fill(NEW_PASSWORD)
    await page.getByTestId('reset-password-submit').click()
    await expect(page.getByTestId('reset-password-success')).toBeVisible()

    // ── The old password no longer works… ────────────────────────────────
    await logInPage.visit()
    await logInPage.logIn(ADMIN.email, PASSWORD)
    await expect(page.getByTestId('login-error')).toBeVisible()

    // ── …and the new one does ────────────────────────────────────────────
    await logInOnApex(page, ADMIN.email, NEW_PASSWORD)
  })
})
