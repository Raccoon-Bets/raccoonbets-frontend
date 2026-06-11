import { test, expect } from './fixtures'
import {
  ADMIN,
  GROUP_URL,
  MEMBER,
  createMarket,
  lockMarket,
  logInToGroup,
  logOut,
  placePosition,
  resolveMarket,
} from './helpers'

// Oracle delegation: the creator names another member as oracle. Both the
// creator (an admin) and the delegated oracle get the resolve affordance,
// and the oracle — a plain member — actually resolves.

test.describe('Oracle delegation: a non-creator oracle resolves', () => {
  test('the delegated oracle sees the resolve link and resolves the market', async ({
    page,
    resetDatabase: _reset,
  }) => {
    // ── The admin creates the market with the member as oracle ───────────
    await logInToGroup(page, ADMIN.email)
    const marketId = await createMarket(page, 'Will the oracle show up?', {
      oracleName: MEMBER.name,
    })
    await expect(page.getByText(`Oracle: ${MEMBER.name}`)).toBeVisible()
    // The creator is an admin, so they keep the resolve affordance too.
    await expect(page.getByTestId('resolve-link')).toBeVisible()
    await placePosition(page, marketId, 'YES', '1')
    await logOut(page)

    // ── The oracle takes the other side, then the market locks ───────────
    await logInToGroup(page, MEMBER.email)
    await placePosition(page, marketId, 'NO', '1')
    await lockMarket(marketId)

    // ── The oracle (a plain member) resolves ─────────────────────────────
    await page.goto(`${GROUP_URL}/markets/${String(marketId)}`)
    await expect(page.getByTestId('market-locked')).toBeVisible()
    await expect(page.getByTestId('resolve-link')).toBeVisible()
    await resolveMarket(page, marketId, 'NO')

    await expect(page.getByTestId('market-events')).toContainText(`${MEMBER.name} resolved to NO`)
    const payouts = page.getByTestId('payouts')
    await expect(payouts.locator('li', { hasText: MEMBER.name })).toContainText('+$1.00')
    await expect(payouts.locator('li', { hasText: ADMIN.name })).toContainText('-$1.00')
  })
})
