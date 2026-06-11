import { test, expect } from './fixtures'
import {
  ADMIN,
  GROUP_URL,
  MEMBER,
  createMarket,
  joinViaInvitation,
  lockMarket,
  logInToGroup,
  logOut,
  placePosition,
  resolveMarket,
} from './helpers'

// A three-outcome market with a payout that doesn't divide evenly. Amounts:
// Cypress User $1.00 on NYC, Trash Panda $2.00 on NYC, Cypress Friend $1.00
// on SF. NYC wins, so the $1.00 losing pool splits pro-rata over the $3.00
// winning pool: exact shares are 33⅓¢ and 66⅔¢, floored to 33¢ and 66¢, and
// largest-remainder hands the leftover cent to Trash Panda (remainder ⅔ > ⅓):
// +$0.33 / +$0.67 / -$1.00, summing to zero.

const THIRD = { email: 'panda@example.com', name: 'Trash Panda' }

test.describe('Multi-outcome market: pro-rata payouts with rounding', () => {
  test('splits the losing pool by largest remainder across two winners', async ({
    page,
    resetDatabase: _reset,
  }) => {
    // ── A third member joins via the invitation flow ─────────────────────
    await joinViaInvitation(page, THIRD.name, THIRD.email)
    await logOut(page)

    // ── The admin creates the three-outcome market and backs NYC ─────────
    await logInToGroup(page, ADMIN.email)
    const marketId = await createMarket(page, 'Where will the raccoon move?', {
      outcomes: ['NYC', 'SF', 'Stays'],
    })
    await placePosition(page, marketId, 'NYC', '1')
    await logOut(page)

    // ── The other two take their positions ───────────────────────────────
    await logInToGroup(page, MEMBER.email)
    await placePosition(page, marketId, 'SF', '1')
    await logOut(page)

    await logInToGroup(page, THIRD.email)
    await placePosition(page, marketId, 'NYC', '2')
    await logOut(page)

    // ── Lock and resolve to NYC ──────────────────────────────────────────
    await lockMarket(marketId)
    await logInToGroup(page, ADMIN.email)
    await resolveMarket(page, marketId, 'NYC')

    // ── Exact largest-remainder payouts ──────────────────────────────────
    const payouts = page.getByTestId('payouts')
    await expect(payouts.locator('li', { hasText: ADMIN.name })).toContainText('+$0.33')
    await expect(payouts.locator('li', { hasText: THIRD.name })).toContainText('+$0.67')
    await expect(payouts.locator('li', { hasText: MEMBER.name })).toContainText('-$1.00')

    // ── And the same numbers land in the settle-up balances ──────────────
    await page.goto(`${GROUP_URL}/settle-up`)
    const balances = page.getByTestId('balances')
    await expect(balances.locator('tr', { hasText: ADMIN.name })).toContainText('$0.33')
    await expect(balances.locator('tr', { hasText: THIRD.name })).toContainText('$0.67')
    await expect(balances.locator('tr', { hasText: MEMBER.name })).toContainText('-$1.00')
  })
})
