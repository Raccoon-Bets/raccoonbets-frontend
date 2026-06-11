import { test, expect } from './fixtures'
import { ADMIN, GROUP_URL, logInToGroup, logOut, MEMBER, runTradingRound } from './helpers'

// Flow C settles the imbalance Flow B creates: the losing member owes the
// winner $1, sees Venmo/PayPal deep links for the winner's handles, marks
// the transfer settled, and everything zeroes out.

const VENMO_HANDLE = 'cypress-winner'
const PAYPAL_HANDLE = 'cypresswinner'

test.describe('Flow C: settle-up → mark settled → zeroed', () => {
  test('suggests the transfer with deep links, then zeroes the balances', async ({
    page,
    baseURL,
    resetDatabase: _reset,
  }) => {
    // ── The winner registers payment handles (no Cash App cashtag) ──────
    await logInToGroup(page, ADMIN.email)
    await page.goto(`${baseURL ?? ''}/account`)
    await page.getByTestId('account-venmo').fill(VENMO_HANDLE)
    await page.getByTestId('account-paypal').fill(PAYPAL_HANDLE)
    await page.getByTestId('account-submit').click()
    await expect(page.getByTestId('account-success')).toBeVisible()

    // ── Create the $1 imbalance through the same UI steps as Flow B ─────
    await runTradingRound(page, 'Will the trash can survive the night?')
    await logOut(page)

    // ── The debtor sees the suggested transfer with payment links ───────
    await logInToGroup(page, MEMBER.email)
    await page.goto(`${GROUP_URL}/settle-up`)

    const transfers = page.getByTestId('transfers')
    await expect(transfers).toContainText(`${MEMBER.name} pays ${ADMIN.name}`)
    await expect(transfers).toContainText('$1.00')

    const venmoLink = page.getByTestId('pay-venmo')
    await expect(venmoLink).toHaveAttribute(
      'href',
      `https://venmo.com/${VENMO_HANDLE}?txn=pay&amount=1.00&note=Raccoon+Bets+%E2%80%94+Cypress+Den`,
    )
    await expect(page.getByTestId('pay-paypal')).toHaveAttribute(
      'href',
      `https://paypal.me/${PAYPAL_HANDLE}/1.00`,
    )
    // No cashtag registered, so no Cash App link.
    await expect(page.getByTestId('pay-cashapp')).toHaveCount(0)

    // ── Mark it settled (the method select defaults to Venmo) ───────────
    await expect(page.getByTestId('settle-method')).toContainText('Venmo')
    await page.getByTestId('mark-settled').click()

    // ── Everything zeroes out ───────────────────────────────────────────
    await expect(page.getByTestId('transfers-empty')).toBeVisible()
    const balances = page.getByTestId('balances')
    await expect(balances.locator('tr', { hasText: ADMIN.name })).toContainText('$0.00')
    await expect(balances.locator('tr', { hasText: MEMBER.name })).toContainText('$0.00')

    // ── And the settlement lands in the history ─────────────────────────
    const settlements = page.getByTestId('settlements')
    await expect(settlements).toContainText(`${MEMBER.name} paid ${ADMIN.name}`)
    await expect(settlements).toContainText('$1.00')
    await expect(settlements).toContainText('Venmo')
  })
})
