import type { Locator, Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { ADMIN, createMarket, fillNumberInput, logInToGroup, placePosition } from './helpers'

// The full life of a single position: taken, moved to the other side at a new
// amount (the backend upserts the member's one position per market), then
// canceled — with the per-outcome pools and total pool tracking every step.
// Plus the amount bounds: the seeded group uses the defaults, $0.25–$20.00.

// `has` with an exact text match: a plain `hasText` is case-insensitive, so
// the YES row's "no positions" count would also match 'NO'.
function outcomeRow(page: Page, name: string): Locator {
  return page.locator('[data-testid^="outcome-"]', { has: page.getByText(name, { exact: true }) })
}

test.describe('Position lifecycle: take → change → cancel', () => {
  test('upserts the position across outcomes and zeroes the pools on cancel', async ({
    page,
    resetDatabase: _reset,
  }) => {
    await logInToGroup(page, ADMIN.email)
    const marketId = await createMarket(page, 'Will the raccoon learn to juggle?')

    // ── Take: $5 on YES ──────────────────────────────────────────────────
    await placePosition(page, marketId, 'YES', '5')
    await expect(page.getByText('Pool: $5.00')).toBeVisible()
    await expect(outcomeRow(page, 'YES')).toContainText('$5.00')
    await expect(outcomeRow(page, 'YES')).toContainText('100% of pool')
    await expect(outcomeRow(page, 'YES')).toContainText('1 position')
    await expect(outcomeRow(page, 'NO')).toContainText('$0.00')

    // ── Change: move the same position to NO at $7.50 ────────────────────
    await page.getByTestId('order-slip').getByLabel('NO', { exact: true }).check()
    await fillNumberInput(page.getByTestId('position-amount'), '7.50')

    // The payout preview backs the still-held $5 YES stake out of the total
    // pool before previewing NO, so the $7.50 owns the whole post-move pool at
    // 1× — not the 1.7× a double-count of that stake (total $12.50 / $7.50)
    // would show.
    await expect(page.getByTestId('position-payout-preview')).toContainText('Pays 1× if it hits')

    await page.getByTestId('position-submit').click()

    await expect(page.getByText('Pool: $7.50')).toBeVisible()
    await expect(outcomeRow(page, 'NO')).toContainText('$7.50')
    await expect(outcomeRow(page, 'YES')).toContainText('$0.00')
    // Still one position total: the upsert moved it, not duplicated it.
    await expect(outcomeRow(page, 'NO')).toContainText('1 position')
    await expect(outcomeRow(page, 'YES')).toContainText('no positions')

    // ── Cancel: pools back to zero, "no positions" state ─────────────────
    await page.getByTestId('position-cancel').click()
    await expect(page.getByTestId('positions-empty')).toBeVisible()
    await expect(page.getByTestId('position-cancel')).toHaveCount(0)
    await expect(page.getByText('Pool: $0.00')).toBeVisible()
    await expect(outcomeRow(page, 'YES')).toContainText('$0.00')
    await expect(outcomeRow(page, 'NO')).toContainText('$0.00')
  })

  test('rejects amounts outside the group bounds and non-integer cents', async ({
    page,
    resetDatabase: _reset,
  }) => {
    await logInToGroup(page, ADMIN.email)
    await createMarket(page, 'Will anyone trade responsibly?')

    const amountErrors = page.locator('[data-testid="field-errors"][data-name="amount_cents"]')
    const boundsMessage = 'Enter an amount between $0.25 and $20.00.'

    await page.getByTestId('order-slip').getByLabel('YES', { exact: true }).check()

    // ── Below the minimum ────────────────────────────────────────────────
    await fillNumberInput(page.getByTestId('position-amount'), '0.10')
    await page.getByTestId('position-submit').click()
    await expect(amountErrors).toContainText(boundsMessage)

    // ── Above the maximum ────────────────────────────────────────────────
    await fillNumberInput(page.getByTestId('position-amount'), '100')
    await page.getByTestId('position-submit').click()
    await expect(amountErrors).toContainText(boundsMessage)

    // ── Sub-cent input: the amount widget clamps typing to cent precision ─
    await fillNumberInput(page.getByTestId('position-amount'), '5.255')
    await expect(page.getByTestId('position-amount')).toHaveValue('5.25')

    // None of the attempts took a position.
    await expect(page.getByTestId('position-cancel')).toHaveCount(0)
    await expect(page.getByTestId('positions-empty')).toBeVisible()
  })
})
