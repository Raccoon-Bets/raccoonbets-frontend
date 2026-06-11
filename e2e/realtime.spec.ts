import type { BrowserContext, Page } from '@playwright/test'
import { test, expect } from './fixtures'
import {
  ADMIN,
  GROUP_URL,
  MEMBER,
  createMarket,
  lockMarket,
  logInToGroup,
  placePosition,
  resolveMarket,
} from './helpers'

// Realtime updates over the AnyCable stack (anycable RPC + anycable-go +
// Redis, per Procfile.e2e): two members watch the same screens in separate
// browser contexts, and one's actions appear on the other's page without any
// reload. Each page's WebSocket frames are tracked so a test only acts after
// the watcher's subscription is confirmed — otherwise a broadcast could fire
// before anyone is listening.

const LIVE = { timeout: 15_000 }

/** Collects the Action Cable subscription identifiers a page has confirmed. */
function trackSubscriptions(page: Page): Set<string> {
  const confirmed = new Set<string>()
  page.on('websocket', (socket) => {
    socket.on('framereceived', (frame) => {
      try {
        const payload = JSON.parse(String(frame.payload)) as {
          type?: string
          identifier?: string
        }
        if (payload.type === 'confirm_subscription' && payload.identifier !== undefined) {
          confirmed.add(payload.identifier)
        }
      } catch {
        // Not JSON (e.g. a ping frame); ignore.
      }
    })
  })
  return confirmed
}

async function waitForSubscription(confirmed: Set<string>, channel: string): Promise<void> {
  await expect(() => {
    if (![...confirmed].some((identifier) => identifier.includes(`"${channel}"`))) {
      throw new Error(`No confirmed ${channel} subscription yet`)
    }
  }).toPass(LIVE)
}

test.describe('Realtime: live updates across browser contexts', () => {
  let contextA: BrowserContext
  let contextB: BrowserContext
  let pageA: Page
  let pageB: Page
  let confirmedB: Set<string>

  test.beforeEach(async ({ browser, resetDatabase: _reset }) => {
    contextA = await browser.newContext()
    contextB = await browser.newContext()
    pageA = await contextA.newPage()
    pageB = await contextB.newPage()
    confirmedB = trackSubscriptions(pageB)
    await logInToGroup(pageA, ADMIN.email)
    await logInToGroup(pageB, MEMBER.email)
  })

  test.afterEach(async () => {
    await contextA.close()
    await contextB.close()
  })

  test('pool totals and resolution reach a watching member live', async () => {
    const marketId = await createMarket(pageA, 'Will the watcher see it live?')

    // ── B opens the market and subscribes to its channel ─────────────────
    await pageB.goto(`${GROUP_URL}/markets/${String(marketId)}`)
    await expect(pageB.getByText('Pool: $0.00')).toBeVisible()
    await waitForSubscription(confirmedB, 'MarketChannel')

    // ── A takes a position; B's pools update without a reload ────────────
    await placePosition(pageA, marketId, 'YES', '3')
    await expect(pageB.getByText('Pool: $3.00')).toBeVisible(LIVE)
    await expect(
      pageB.locator('[data-testid^="outcome-"]', { has: pageB.getByText('YES', { exact: true }) }),
    ).toContainText('$3.00')

    // ── A resolves; B's page flips to the resolved state live ────────────
    await lockMarket(marketId)
    await resolveMarket(pageA, marketId, 'YES')
    await expect(pageB.getByTestId('market-resolved')).toBeVisible(LIVE)
    await expect(pageB.getByTestId('market-resolved')).toContainText('YES')
  })

  test('a new market appears in a watching member’s feed live', async () => {
    // logInToGroup leaves B on the feed, which subscribes to GroupChannel.
    await expect(pageB.getByTestId('feed-open-empty')).toBeVisible()
    await waitForSubscription(confirmedB, 'GroupChannel')

    const marketId = await createMarket(pageA, 'Did the feed hear about this?')
    await expect(pageB.getByTestId(`market-card-${String(marketId)}`)).toContainText(
      'Did the feed hear about this?',
      LIVE,
    )
  })
})
