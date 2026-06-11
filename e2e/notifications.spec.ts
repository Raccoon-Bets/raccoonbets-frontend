import { test, expect } from './fixtures'
import { ADMIN, APEX_URL, logInOnApex } from './helpers'

// The notification preferences panel on the apex /account page: every event x
// channel toggle renders, and turning one off round-trips through PATCH /account
// so it survives a cold reload. Real push delivery is out of scope here.

test.describe('Account: notification preferences', () => {
  test('toggles a channel off and persists it across a reload', async ({
    page,
    resetDatabase: _reset,
  }) => {
    await logInOnApex(page, ADMIN.email)
    await page.goto(`${APEX_URL}/account`)

    // The panel renders with a row per notifiable event.
    const panel = page.getByTestId('notifications-section')
    await expect(panel).toBeVisible()
    for (const event of [
      'market_resolved',
      'market_created',
      'settlement',
      'market_closing_soon',
    ]) {
      await expect(panel.getByTestId(`pref-${event}-email`)).toBeVisible()
      await expect(panel.getByTestId(`pref-${event}-push`)).toBeVisible()
    }

    // Channels default ON; turn the "new market" email off.
    const marketCreatedEmail = panel.getByTestId('pref-market_created-email').locator('input')
    await expect(marketCreatedEmail).toBeChecked()
    await marketCreatedEmail.uncheck()
    await expect(marketCreatedEmail).not.toBeChecked()

    // A cold load re-fetches the account from the backend; the toggle stayed off,
    // proving the preference persisted via PATCH /account.
    await page.reload()
    await expect(page.getByTestId('pref-market_created-email').locator('input')).not.toBeChecked()
    // A channel we never touched is still ON.
    await expect(page.getByTestId('pref-market_created-push').locator('input')).toBeChecked()
  })
})
