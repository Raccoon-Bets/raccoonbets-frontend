import { test, expect } from './fixtures'
import { ADMIN, APEX_URL, logInOnApex } from './helpers'

// Account editing on the apex /account page: profile name and the optional
// payment handles, with persistence verified on a fresh page load.

test.describe('Account: profile and payment handles', () => {
  test('updates the name and payment handles, persisting across reload', async ({
    page,
    resetDatabase: _reset,
  }) => {
    await logInOnApex(page, ADMIN.email)
    await page.goto(`${APEX_URL}/account`)

    await page.getByTestId('account-name').fill('Cypress User, Esq.')
    await page.getByTestId('account-venmo').fill('cypress-venmo')
    await page.getByTestId('account-paypal').fill('cypresspaypal')
    await page.getByTestId('account-cashapp').fill('cypresscash')
    await page.getByTestId('account-submit').click()
    await expect(page.getByTestId('account-success')).toBeVisible()

    // ── A cold load re-fetches the account from the backend ──────────────
    await page.reload()
    await expect(page.getByTestId('account-name')).toHaveValue('Cypress User, Esq.')
    await expect(page.getByTestId('account-venmo')).toHaveValue('cypress-venmo')
    await expect(page.getByTestId('account-paypal')).toHaveValue('cypresspaypal')
    await expect(page.getByTestId('account-cashapp')).toHaveValue('cypresscash')
  })
})
