import { test, expect, fetchLastEmail } from './fixtures'
import {
  ADMIN,
  MEMBER,
  APEX_URL,
  logInOnApex,
  logInToGroup,
  createMarket,
  placePosition,
  lockMarket,
  resolveMarket,
  runTradingRound,
} from './helpers'

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

// The push priming banner tests live in pushBanner.spec.ts: they need a secure-context
// Chromium launch flag, which Playwright only allows at file top level, and isolating them
// keeps the PWA service worker out of these waitForResponse-based tests.

test.describe('Notification emails', () => {
  test('emails a participating non-actor when their market resolves', async ({
    page,
    resetDatabase: _reset,
  }) => {
    // runTradingRound has ADMIN create a YES/NO market and take YES, MEMBER take NO,
    // then ADMIN (the oracle) resolve YES. ADMIN is the actor, so the dispatcher does
    // not notify them; MEMBER is the participating non-actor who is emailed.
    const marketId = await runTradingRound(page, 'Resolved email round')

    // fetchLastEmail() returns only the parsed text/html BODY (PostalMime drops the
    // headers), so the "Resolved: <title>" subject line is not assertable here. The
    // market_resolved body names the market and states it "was resolved".
    const email = await fetchLastEmail()
    expect(email).not.toBeNull()
    const body = email!.text + email!.html
    expect(body).toContain('Resolved email round')
    expect(body).toContain('was resolved')
    expect(marketId).toBeGreaterThan(0)
  })

  test('does not email a recipient who turned off the market_resolved email', async ({
    page,
    resetDatabase: _reset,
  }) => {
    // MEMBER opts out of market_resolved email before participating in a market.
    await logInOnApex(page, MEMBER.email)
    await page.goto(`${APEX_URL}/account`)
    const resolvedEmail = page.getByTestId('pref-market_resolved-email').locator('input')
    await expect(resolvedEmail).toBeChecked()
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith('/account') && r.request().method() === 'PATCH' && r.ok(),
      ),
      resolvedEmail.uncheck(),
    ])
    await expect(resolvedEmail).not.toBeChecked()

    // ADMIN creates the market (and is its oracle) but takes NO position, so MEMBER is the
    // SOLE holder and therefore the only market_resolved recipient. The cypress last_email
    // endpoint exposes only the single most-recent delivery and strips MIME headers, so it
    // cannot name the recipient or scan the outbox for an absent message. Making MEMBER the
    // only eligible recipient sidesteps that: with MEMBER opted out of the resolved email,
    // NO market_resolved email is sent at all, so the last email of the round must not be a
    // resolved notification for this market. The body identifies a market_resolved email by
    // its "...was resolved" heading plus the market title.
    await logInToGroup(page, ADMIN.email)
    const marketId = await createMarket(page, 'Opt-out resolved round')

    await logInToGroup(page, MEMBER.email)
    await placePosition(page, marketId, 'YES', '1')

    await lockMarket(marketId)

    await logInToGroup(page, ADMIN.email)
    await resolveMarket(page, marketId, 'YES')

    const email = await fetchLastEmail()
    if (email !== null) {
      const body = email.text + email.html
      const isResolvedForThisMarket =
        body.includes('was resolved') && body.includes('Opt-out resolved round')
      expect(isResolvedForThisMarket).toBe(false)
    }
  })
})
