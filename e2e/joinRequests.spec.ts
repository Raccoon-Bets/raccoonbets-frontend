import { test, expect, extractEmailURL, fetchLastEmail } from './fixtures'
import {
  ADMIN,
  GROUP_URL,
  logInToGroup,
  logOut,
  PASSWORD,
  signUpAndRequestToJoin,
  submitAndConfirm,
} from './helpers'

// Join requests: a verified non-member finds the group's subdomain, requests
// to join, and an admin approves or denies from the members page.

test.describe('Join requests: request → approve / deny', () => {
  test('an approved requester becomes a member and sees the feed', async ({
    page,
    resetDatabase: _reset,
  }) => {
    const requester = { name: 'Hopeful Joiner', email: 'joiner@example.com' }
    await signUpAndRequestToJoin(page, requester.name, requester.email)
    await logOut(page)

    // ── The admin approves from the members page ─────────────────────────
    await logInToGroup(page, ADMIN.email)
    await page.goto(`${GROUP_URL}/members`)
    await page
      .getByTestId('join-requests')
      .locator('li', { hasText: requester.name })
      .getByRole('button', { name: 'Approve' })
      .click()
    await expect(
      page.getByTestId('members-roster').locator('tr', { hasText: requester.name }),
    ).toBeVisible()
    await logOut(page)

    // ── The requester now lands on the feed ──────────────────────────────
    await logInToGroup(page, requester.email)
    await expect(page.getByTestId('current-user-email')).toContainText(requester.email)
  })

  test('a denied requester is back to the join screen', async ({ page, resetDatabase: _reset }) => {
    const requester = { name: 'Unlucky Joiner', email: 'denied@example.com' }
    await signUpAndRequestToJoin(page, requester.name, requester.email)
    await logOut(page)

    // ── The admin denies (confirming the dialog) ─────────────────────────
    page.on('dialog', (dialog) => void dialog.accept())
    await logInToGroup(page, ADMIN.email)
    await page.goto(`${GROUP_URL}/members`)
    await page
      .getByTestId('join-requests')
      .locator('li', { hasText: requester.name })
      .getByRole('button', { name: 'Deny' })
      .click()
    await expect(page.getByTestId('join-requests-empty')).toBeVisible()
    await logOut(page)

    // ── The requester can ask again — no pending request, no membership ──
    await page.goto(`${GROUP_URL}/login`)
    await page.getByTestId('login-email').fill(requester.email)
    await page.getByTestId('login-password').fill(PASSWORD)
    await submitAndConfirm(page.getByTestId('login-submit'), async () => {
      await page.waitForURL(`${GROUP_URL}/join`, { timeout: 5000 })
    })
    await expect(page.getByTestId('join-request-button')).toBeVisible()
  })
})

test.describe('Join requests: invite link', () => {
  test('a shared join link signs the visitor up and auto-submits their request', async ({
    page,
    resetDatabase: _reset,
  }) => {
    const joiner = { name: 'Invited Friend', email: 'invited@example.com' }

    // ── The logged-out invite-link visit bounces to the subdomain login ──
    await page.goto(`${GROUP_URL}/join`)
    await page.waitForURL(`${GROUP_URL}/login`)

    // ── The visitor signs up instead, staying on the subdomain ───────────
    await page.getByRole('link', { name: 'Need an account? Sign up' }).click()
    await page.waitForURL(`${GROUP_URL}/signup`)
    await page.getByTestId('signup-name').fill(joiner.name)
    await page.getByTestId('signup-email').fill(joiner.email)
    await page.getByTestId('signup-password').fill(PASSWORD)
    await submitAndConfirm(page.getByTestId('signup-submit'), async () => {
      await expect(page.getByTestId('signup-success')).toBeVisible({ timeout: 5000 })
    })

    // ── The verification link points back at the group subdomain ─────────
    const verification = await fetchLastEmail()
    expect(verification).not.toBeNull()
    const verificationURL = extractEmailURL(verification!)
    expect(verificationURL.startsWith(GROUP_URL)).toBe(true)
    await page.goto(verificationURL)
    await expect(page.getByTestId('verify-account-success')).toBeVisible()

    // ── After the auto-redirect to login, log in to claim the auto-submitted request ──
    await page.waitForURL(`${GROUP_URL}/login`)
    await page.getByTestId('login-email').fill(joiner.email)
    await page.getByTestId('login-password').fill(PASSWORD)
    await submitAndConfirm(page.getByTestId('login-submit'), async () => {
      await page.waitForURL(`${GROUP_URL}/join`, { timeout: 5000 })
    })
    await expect(page.getByTestId('join-requested')).toBeVisible()
    await logOut(page)

    // ── The admin sees the auto-submitted request ─────────────────────────
    await logInToGroup(page, ADMIN.email)
    await page.goto(`${GROUP_URL}/members`)
    await expect(
      page.getByTestId('join-requests').locator('li', { hasText: joiner.name }),
    ).toBeVisible()
  })
})
