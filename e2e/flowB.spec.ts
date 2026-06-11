import { test, expect } from './fixtures'
import { ADMIN, GROUP_URL, MEMBER, runTradingRound } from './helpers'

// Flow B exercises the full trading loop: a market is created, both seeded
// users take opposite sides at $1, the market locks (via the cypress
// time-travel helper), and the oracle resolves it. The loser's dollar moves
// to the winner, visible in the market's payouts and the settle-up balances.

test.describe('Flow B: position → lock → resolve → balances', () => {
  test('moves the losing amount to the winner and shows it everywhere', async ({
    page,
    resetDatabase: _reset,
  }) => {
    await runTradingRound(page, 'Will the raccoon open the latch?')

    // ── Payouts on the market detail ────────────────────────────────────
    const payouts = page.getByTestId('payouts')
    await expect(payouts.locator('li', { hasText: ADMIN.name })).toContainText('+$1.00')
    await expect(payouts.locator('li', { hasText: MEMBER.name })).toContainText('-$1.00')

    // ── The resolution shows in the audit trail ─────────────────────────
    await expect(page.getByTestId('market-events')).toContainText(`${ADMIN.name} resolved to YES`)

    // ── Balances on settle-up reflect ±100 cents ────────────────────────
    await page.goto(`${GROUP_URL}/settle-up`)
    const balances = page.getByTestId('balances')
    await expect(balances.locator('tr', { hasText: ADMIN.name })).toContainText('$1.00')
    await expect(balances.locator('tr', { hasText: MEMBER.name })).toContainText('-$1.00')

    // The member's own balance shows on /me too.
    await page.goto(`${GROUP_URL}/me`)
    await expect(page.getByTestId('my-balance')).toContainText('$1.00')
  })
})
