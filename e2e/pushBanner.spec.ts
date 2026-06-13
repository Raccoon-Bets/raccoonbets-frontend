import { test, expect } from './fixtures'
import { ADMIN, APEX_URL, logInOnApex } from './helpers'

// The push priming banner only renders when pushSupported() is true, which needs the
// serviceWorker and PushManager APIs — and those only exist in a secure context. The e2e
// stack serves the SPA over plain http://lvh.me:4173, so we tell Chromium to treat that
// origin as secure, the same way the passkeys spec satisfies WebAuthn's secure-context
// requirement. Playwright forbids channel/launchOptions inside a describe (they force a
// new worker), so these tests live in their own file rather than alongside the prefs and
// email tests in notifications.spec.ts. Keeping them separate also means the PWA service
// worker (NetworkFirst caching, registered on load once the origin is secure) never runs
// during those waitForResponse-based tests, where its caching could cause flakiness.
test.use({
  channel: 'chromium',
  launchOptions: {
    args: ['--unsafely-treat-insecure-origin-as-secure=http://lvh.me:4173'],
  },
})

test.describe('Push priming banner', () => {
  test('shows for a logged-in user who has not decided on push', async ({
    page,
    resetDatabase: _reset,
  }) => {
    await logInOnApex(page, ADMIN.email)
    await page.goto(`${APEX_URL}/account`)
    await expect(page.getByTestId('push-priming-banner')).toBeVisible()
  })

  test('"Don\'t bother me again" hides it and persists across reload', async ({
    page,
    resetDatabase: _reset,
  }) => {
    await logInOnApex(page, ADMIN.email)
    await page.goto(`${APEX_URL}/account`)

    const banner = page.getByTestId('push-priming-banner')
    await expect(banner).toBeVisible()

    await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith('/account') && r.request().method() === 'PATCH' && r.ok(),
      ),
      page.getByTestId('push-priming-dismiss').click(),
    ])
    await expect(banner).toBeHidden()

    await page.reload()
    await expect(page.getByTestId('push-priming-banner')).toBeHidden()
  })

  test('does not show when notification permission is already granted', async ({
    browser,
    resetDatabase: _reset,
  }) => {
    const context = await browser.newContext({ permissions: ['notifications'] })
    const page = await context.newPage()
    await logInOnApex(page, ADMIN.email)
    await page.goto(`${APEX_URL}/account`)
    await expect(page.getByTestId('notifications-section')).toBeVisible()
    await expect(page.getByTestId('push-priming-banner')).toBeHidden()
    await context.close()
  })

  // A context with notifications granted makes permission 'granted', so the app should
  // silently subscribe the device by POSTing the PushSubscription. Fixme because the
  // automated Chromium build has no push messaging service: with the secure-context flag
  // the prerequisites are all satisfied (isSecureContext true, serviceWorker ready,
  // Notification.permission 'granted'), but pushManager.subscribe() itself rejects with
  // "AbortError: Registration failed - permission denied" — there is no GCM/FCM endpoint to
  // register against. ensurePushSubscription() therefore never reaches the POST. This is a
  // push-service limitation of the test browser, not the secure-context issue (now solved).
  test.fixme('subscribes the device when notification permission is granted', async ({
    browser,
    resetDatabase: _reset,
  }) => {
    const context = await browser.newContext({ permissions: ['notifications'] })
    const page = await context.newPage()

    const subscribed = page.waitForRequest(
      (r) => r.url().endsWith('/account/push_subscriptions') && r.method() === 'POST',
      { timeout: 15_000 },
    )
    await logInOnApex(page, ADMIN.email)
    await page.goto(`${APEX_URL}/account`)
    await subscribed
    await context.close()
  })
})
