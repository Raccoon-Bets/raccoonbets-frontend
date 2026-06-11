import { test, expect } from './fixtures'
import {
  ADMIN,
  GROUP_URL,
  MEMBER,
  createMarket,
  logInToGroup,
  logOut,
  runTradingRound,
} from './helpers'

// Resolution governance beyond the happy path Flow B covers: an admin
// correcting a resolved market (payouts flip), voiding a resolved market
// (balances revert), voiding an open market (no money ever moved), and the
// resolve screen turning plain members away.

test.describe('Resolution governance: correct, void, and access control', () => {
  test('an admin correction flips the payouts and the balances', async ({
    page,
    resetDatabase: _reset,
  }) => {
    // Flow B's round: admin $1 on YES, member $1 on NO, resolved YES.
    const marketId = await runTradingRound(page, 'Did the raccoon knock it over?')

    await page.goto(`${GROUP_URL}/markets/${String(marketId)}/resolve`)
    await page.getByTestId('correct-form').getByLabel('NO', { exact: true }).check()
    await page.getByTestId('correct-submit').click()
    await page.waitForURL(new RegExp(`/markets/${String(marketId)}(?:-[^/]*)?$`))

    // ── The payouts now favor the member ─────────────────────────────────
    const payouts = page.getByTestId('payouts')
    await expect(payouts.locator('li', { hasText: MEMBER.name })).toContainText('+$1.00')
    await expect(payouts.locator('li', { hasText: ADMIN.name })).toContainText('-$1.00')
    await expect(page.getByTestId('market-events')).toContainText(`${ADMIN.name} corrected to NO`)

    // ── And the settle-up balances flipped with them ─────────────────────
    await page.goto(`${GROUP_URL}/settle-up`)
    const balances = page.getByTestId('balances')
    await expect(balances.locator('tr', { hasText: MEMBER.name })).toContainText('$1.00')
    await expect(balances.locator('tr', { hasText: ADMIN.name })).toContainText('-$1.00')
  })

  test('voiding a resolved market returns the balances to zero', async ({
    page,
    resetDatabase: _reset,
  }) => {
    page.on('dialog', (dialog) => void dialog.accept())
    const marketId = await runTradingRound(page, 'Will this resolution stick?')

    await page.goto(`${GROUP_URL}/markets/${String(marketId)}/resolve`)
    await page.getByTestId('void-button').click()
    await page.waitForURL(new RegExp(`/markets/${String(marketId)}(?:-[^/]*)?$`))
    await expect(page.getByTestId('market-voided')).toBeVisible()
    await expect(page.getByTestId('market-events')).toContainText(`${ADMIN.name} voided the market`)

    await page.goto(`${GROUP_URL}/settle-up`)
    await expect(page.getByTestId('transfers-empty')).toBeVisible()
    const balances = page.getByTestId('balances')
    await expect(balances.locator('tr', { hasText: ADMIN.name })).toContainText('$0.00')
    await expect(balances.locator('tr', { hasText: MEMBER.name })).toContainText('$0.00')
  })

  test('the creator can void an open market without moving any money', async ({
    page,
    resetDatabase: _reset,
  }) => {
    page.on('dialog', (dialog) => void dialog.accept())
    await logInToGroup(page, ADMIN.email)
    const marketId = await createMarket(page, 'Never mind, actually?')

    await page.goto(`${GROUP_URL}/markets/${String(marketId)}/resolve`)
    // Trading hasn't even closed; voiding early is still allowed.
    await expect(page.getByTestId('still-open')).toBeVisible()
    await page.getByTestId('void-button').click()
    await page.waitForURL(new RegExp(`/markets/${String(marketId)}(?:-[^/]*)?$`))
    await expect(page.getByTestId('market-voided')).toBeVisible()

    await page.goto(`${GROUP_URL}/settle-up`)
    await expect(page.getByTestId('transfers-empty')).toBeVisible()
    const balances = page.getByTestId('balances')
    await expect(balances.locator('tr', { hasText: ADMIN.name })).toContainText('$0.00')
    await expect(balances.locator('tr', { hasText: MEMBER.name })).toContainText('$0.00')
  })

  test('a member who is neither oracle nor admin cannot reach the resolve screen', async ({
    page,
    resetDatabase: _reset,
  }) => {
    await logInToGroup(page, ADMIN.email)
    const marketId = await createMarket(page, 'Who guards the guards?')
    await logOut(page)

    await logInToGroup(page, MEMBER.email)
    await page.goto(`${GROUP_URL}/markets/${String(marketId)}`)
    await expect(page.getByTestId('market-detail-title')).toHaveText('Who guards the guards?')
    await expect(page.getByTestId('resolve-link')).toHaveCount(0)

    // Navigating straight to /resolve bounces back to the market detail.
    await page.goto(`${GROUP_URL}/markets/${String(marketId)}/resolve`)
    await page.waitForURL(new RegExp(`/markets/${String(marketId)}(?:-[^/]*)?$`))
    await expect(page.getByTestId('market-detail-title')).toHaveText('Who guards the guards?')
  })
})
