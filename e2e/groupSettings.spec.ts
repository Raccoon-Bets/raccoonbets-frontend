import { test, expect } from './fixtures'
import { ADMIN, createMarket, fillNumberInput, GROUP_URL, logInToGroup, MEMBER } from './helpers'

// Group settings: an admin renames the group and tightens the amount bounds,
// and both changes show up where they matter — the feed header and the order
// slip's allowed-range hint.

test.describe('Group settings: name and amount bounds', () => {
  test('an admin edits the name and amount bounds, and the app reflects them', async ({
    page,
    resetDatabase: _reset,
  }) => {
    await logInToGroup(page, ADMIN.email)
    await page.getByTestId('settings-link').click()

    await page.getByTestId('settings-name').fill('Cypress Lodge')
    await fillNumberInput(page.getByTestId('settings-min-amount'), '5.00')
    await fillNumberInput(page.getByTestId('settings-max-amount'), '20.00')
    await page.getByTestId('settings-submit').click()
    await expect(page.getByTestId('settings-success')).toBeVisible()

    // ── The feed header carries the new name ─────────────────────────────
    await page.goto(`${GROUP_URL}/`)
    await expect(page.getByTestId('feed-title')).toContainText('Cypress Lodge')

    // ── A market's order slip advertises the new bounds ──────────────────
    await createMarket(page, 'Will anyone trade within the new limits?')
    await expect(page.getByTestId('position-amount-range')).toHaveText('Between $5.00 and $20.00.')
  })

  test('a non-admin member sees the read-only notice', async ({ page, resetDatabase: _reset }) => {
    await logInToGroup(page, MEMBER.email)
    await page.goto(`${GROUP_URL}/settings`)

    await expect(page.getByTestId('settings-not-admin')).toBeVisible()
    await expect(page.getByTestId('settings-submit')).toHaveCount(0)
  })
})
