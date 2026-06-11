import { test, expect } from './fixtures'
import { ADMIN, GROUP_URL, MEMBER, logInToGroup, logOut, runTradingRound } from './helpers'

// Settlement voiding: after Flow B's round is settled, voiding the payment
// from the history brings the debt right back — the balances reopen and the
// suggested transfer reappears, while the voided settlement stays in the
// history, struck through.

test.describe('Settlement void: the debt comes back', () => {
  test('voiding a settled transfer restores the balances and the suggestion', async ({
    page,
    resetDatabase: _reset,
  }) => {
    page.on('dialog', (dialog) => void dialog.accept())

    // ── Create the $1 imbalance and settle it as the debtor ──────────────
    await runTradingRound(page, 'Will the ledger stay settled?')
    await logOut(page)

    await logInToGroup(page, MEMBER.email)
    await page.goto(`${GROUP_URL}/settle-up`)
    await page.getByTestId('mark-settled').click()
    await expect(page.getByTestId('transfers-empty')).toBeVisible()

    // ── Void it from the history ─────────────────────────────────────────
    const settlements = page.getByTestId('settlements')
    const settlementRow = settlements.locator('tr', {
      hasText: `${MEMBER.name} paid ${ADMIN.name}`,
    })
    await settlementRow.getByRole('button', { name: 'Void' }).click()

    // The settlement stays in the history, tagged voided.
    await expect(settlementRow).toContainText('voided')
    await expect(settlementRow.getByRole('button', { name: 'Void' })).toHaveCount(0)

    // ── The transfer and the ±$1.00 balances are back ────────────────────
    await expect(page.getByTestId('transfers')).toContainText(`${MEMBER.name} pays ${ADMIN.name}`)
    await expect(page.getByTestId('transfers-empty')).toHaveCount(0)
    const balances = page.getByTestId('balances')
    await expect(balances.locator('tr', { hasText: ADMIN.name })).toContainText('$1.00')
    await expect(balances.locator('tr', { hasText: MEMBER.name })).toContainText('-$1.00')
  })
})
