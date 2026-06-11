import { test, expect } from './fixtures'
import {
  APEX_URL,
  ADMIN,
  joinViaInvitation,
  logInOnApex,
  logInToGroup,
  logOut,
  sendInvitation,
  signUpAndVerify,
} from './helpers'

// Email invitations: the admin invites a brand-new address, the invitee signs
// up, verifies, and accepts into the group; plus the revoked-link dead end.

test.describe('Invitations: email invite → accept; revoked links die', () => {
  test('a new person joins via an emailed invitation', async ({ page, resetDatabase: _reset }) => {
    await joinViaInvitation(page, 'New Person', 'newperson@example.com')

    // The helper leaves the invitee on the group feed, logged in.
    await expect(page.getByTestId('current-user-email')).toContainText('newperson@example.com')

    // ── The group shows up in the invitee's apex groups list ─────────────
    await page.goto(`${APEX_URL}/groups`)
    await expect(page.getByTestId('group-link-cypress-den')).toBeVisible()
  })

  test('a revoked invitation link shows the no-longer-valid state', async ({
    page,
    resetDatabase: _reset,
  }) => {
    const EMAIL = 'revoked@example.com'

    // ── The admin invites, then thinks better of it ──────────────────────
    await logInToGroup(page, ADMIN.email)
    const invitePath = await sendInvitation(page, EMAIL)
    await page
      .getByTestId('invitations')
      .locator('li', { hasText: EMAIL })
      .getByRole('button', { name: 'Revoke' })
      .click()
    await expect(page.getByTestId('invitations-empty')).toBeVisible()
    await logOut(page)

    // ── The invitee still follows the dead link ──────────────────────────
    await signUpAndVerify(page, 'Revoked Person', EMAIL)
    await logInOnApex(page, EMAIL)
    await page.goto(APEX_URL + invitePath)
    await expect(page.getByTestId('invitation-invalid')).toBeVisible()
    await expect(page.getByTestId('invitation-accept')).toHaveCount(0)
  })
})
