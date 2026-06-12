import { test, expect } from './fixtures'
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
