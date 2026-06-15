import type { Locator, Page } from '@playwright/test'
import { expect, extractEmailPath, fetchLastEmail } from './fixtures'

// The seeded group and users from the backend's Cypress::Reset middleware.
export const APEX_URL = 'http://lvh.me:4173'
export const GROUP_URL = 'http://cypress-den.lvh.me:4173'
export const ADMIN = { email: 'cypress@example.com', name: 'Cypress User' }
export const MEMBER = { email: 'cypress2@example.com', name: 'Cypress Friend' }
export const PASSWORD = 'supersecret'

const API_HOST = 'http://127.0.0.1:5000'

/** How long a Turnstile-gated submit must stay enabled before a click is trusted. */
const TURNSTILE_SETTLE_MS = 500

/**
 * Clicks a Turnstile-gated submit once it has stayed continuously enabled for
 * {@link TURNSTILE_SETTLE_MS}. The widget re-issues its token shortly after first enabling the
 * button, and a click landing in that brief re-disabled window is silently swallowed by the
 * browser (disabled controls receive no mouse events).
 */
export async function clickTurnstileSubmit(submit: Locator): Promise<void> {
  const deadline = Date.now() + 15_000
  let enabledSince: number | null = null
  while (enabledSince === null || Date.now() - enabledSince < TURNSTILE_SETTLE_MS) {
    if (Date.now() > deadline) throw new Error('Turnstile-gated submit never settled enabled')
    enabledSince = (await submit.isEnabled()) ? (enabledSince ?? Date.now()) : null
    await submit.page().waitForTimeout(50)
  }
  await submit.click()
}

/**
 * Clicks a Turnstile-gated submit and waits for `confirmed` to acknowledge the result,
 * re-clicking in case a click was still swallowed by a token re-issue. The final attempt
 * propagates its own failure.
 */
export async function submitAndConfirm(
  submit: Locator,
  confirmed: () => Promise<void>,
): Promise<void> {
  for (let attempt = 1; attempt < 3; attempt++) {
    await clickTurnstileSubmit(submit)
    try {
      await confirmed()
      return
    } catch {
      // The click may still have been swallowed; settle and try again.
    }
  }
  await clickTurnstileSubmit(submit)
  await confirmed()
}

/** Logs in on the group subdomain and waits for the feed to load. */
export async function logInToGroup(page: Page, email: string): Promise<void> {
  await page.goto(`${GROUP_URL}/login`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(PASSWORD)
  await submitAndConfirm(page.getByTestId('login-submit'), async () => {
    await expect(page.getByTestId('feed-title')).toBeVisible({ timeout: 5000 })
  })
}

/** Logs in on the apex and waits to land on the groups page. */
export async function logInOnApex(
  page: Page,
  email: string,
  password: string = PASSWORD,
): Promise<void> {
  await page.goto(`${APEX_URL}/login`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await submitAndConfirm(page.getByTestId('login-submit'), async () => {
    await page.waitForURL(`${APEX_URL}/groups`, { timeout: 5000 })
  })
}

/**
 * Logs out through the user menu: loads the host's root view (the group feed, the join screen,
 * or the apex landing — all render the menu) and clicks "Log out".
 */
export async function logOut(page: Page, host: string = GROUP_URL): Promise<void> {
  await page.goto(`${host}/`)
  await page.getByTestId('current-user-email').click()
  // The menu popup's enter animation can keep the item's bounding box moving past
  // Playwright's stability check under load; once visible it is hit-testable.
  const logoutItem = page.getByTestId('logout-button')
  await expect(logoutItem).toBeVisible()
  await logoutItem.click({ force: true })
  await page.waitForURL('**/login')
}

/** Signs up a new user on the apex and verifies the account via the emailed link. */
export async function signUpAndVerify(page: Page, name: string, email: string): Promise<void> {
  await page.goto(`${APEX_URL}/signup`)
  await page.getByTestId('signup-name').fill(name)
  await page.getByTestId('signup-email').fill(email)
  await page.getByTestId('signup-password').fill(PASSWORD)
  await submitAndConfirm(page.getByTestId('signup-submit'), async () => {
    await expect(page.getByTestId('signup-success')).toBeVisible({ timeout: 5000 })
  })

  const verification = await fetchLastEmail()
  expect(verification).not.toBeNull()
  await page.goto(extractEmailPath(verification!, APEX_URL))
  await expect(page.getByTestId('verify-account-success')).toBeVisible()
}

/**
 * Signs up and verifies a brand-new user, then visits the seeded group's subdomain and requests
 * to join. Leaves the requester logged in on the join screen with the pending notice showing.
 */
export async function signUpAndRequestToJoin(
  page: Page,
  name: string,
  email: string,
): Promise<void> {
  await signUpAndVerify(page, name, email)
  await logInOnApex(page, email)

  // A non-member visiting the group's subdomain is routed to the join screen.
  await page.goto(`${GROUP_URL}/`)
  await page.waitForURL(`${GROUP_URL}/join`)
  await page.getByTestId('join-request-button').click()
  await expect(page.getByTestId('join-requested')).toBeVisible()
}

/**
 * As the logged-in admin, invites `email` from the members page and resolves to the emailed
 * invitation link as a path relative to the apex.
 */
export async function sendInvitation(page: Page, email: string): Promise<string> {
  await page.goto(`${GROUP_URL}/members`)
  await page.getByTestId('invitation-email').fill(email)
  await page.getByTestId('invitation-submit').click()
  await expect(page.getByTestId('invitations').locator('li', { hasText: email })).toBeVisible()

  const invitation = await fetchLastEmail()
  expect(invitation).not.toBeNull()
  return extractEmailPath(invitation!, APEX_URL)
}

/**
 * Adds a brand-new user to the seeded group via an emailed invitation: the admin sends the
 * invite, then the invitee signs up, verifies, logs in, and accepts. Leaves the invitee logged
 * in on the group feed.
 */
export async function joinViaInvitation(page: Page, name: string, email: string): Promise<void> {
  await logInToGroup(page, ADMIN.email)
  const invitePath = await sendInvitation(page, email)
  await logOut(page)

  await signUpAndVerify(page, name, email)
  await logInOnApex(page, email)
  await page.goto(APEX_URL + invitePath)
  await page.getByTestId('invitation-accept').click()
  await page.waitForURL(`${GROUP_URL}/`)
  await expect(page.getByTestId('feed-title')).toBeVisible()
}

/**
 * Formats a time `minutesFromNow` as the DatePicker's input value, matching the en-US locale
 * format the picker derives via Intl (`mm/dd/yyyy hh:mm AM/PM`, local 12-hour).
 */
export function locksAtValue(minutesFromNow: number): string {
  const date = new Date(Date.now() + minutesFromNow * 60_000)
  const pad = (part: number) => String(part).padStart(2, '0')
  const hours24 = date.getHours()
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  const meridiem = hours24 < 12 ? 'AM' : 'PM'
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${String(date.getFullYear())} ${pad(
    hours12,
  )}:${pad(date.getMinutes())} ${meridiem}`
}

/**
 * Fills a PrimeVue InputNumber by typing: the component only parses keystrokes
 * and paste events, so Playwright's `fill()` would leave its model stale.
 */
export async function fillNumberInput(input: Locator, value: string): Promise<void> {
  await input.click()
  await input.press('ControlOrMeta+a')
  await input.pressSequentially(value)
  await input.blur()
}

/**
 * Creates a market from the feed and resolves to its ID once the app lands on the new market's
 * detail page. Defaults to the form's YES/NO outcomes and the creator as oracle; pass
 * `outcomes` for a custom set and `oracleName` to delegate resolution.
 */
export async function createMarket(
  page: Page,
  title: string,
  options: { outcomes?: string[]; oracleName?: string; openEnded?: boolean } = {},
): Promise<number> {
  await page.goto(`${GROUP_URL}/markets/new`)
  await page.getByTestId('market-title').fill(title)
  if (options.openEnded === true) {
    await page.getByTestId('market-kind').click()
    await page.getByRole('option', { name: /Open-ended/ }).click()
  } else {
    await page.getByTestId('market-locks-at').fill(locksAtValue(30))
  }
  for (const [index, name] of (options.outcomes ?? []).entries()) {
    if (index >= 2) await page.getByTestId('market-add-outcome').click()
    await page.getByTestId(`market-outcome-${String(index)}`).fill(name)
  }
  if (options.oracleName !== undefined) {
    await page.getByTestId('market-oracle').click()
    await page.getByRole('option', { name: options.oracleName }).click()
  }
  await page.getByTestId('market-submit').click()

  await page.waitForURL(/\/markets\/\d+(?:-[^/]*)?$/)
  await expect(page.getByTestId('market-detail-title')).toHaveText(title)
  const match = /\/markets\/(\d+)(?:-[^/]*)?$/.exec(page.url())
  if (!match) throw new Error(`Not on a market detail page: ${page.url()}`)
  return Number(match[1])
}

/** Takes a position of `amount` (decimal major units) on the named outcome of a market. */
export async function placePosition(
  page: Page,
  marketId: number,
  outcomeName: string,
  amount: string,
): Promise<void> {
  await page.goto(`${GROUP_URL}/markets/${String(marketId)}`)
  await page.getByTestId('order-slip').getByLabel(outcomeName, { exact: true }).check()
  await fillNumberInput(page.getByTestId('position-amount'), amount)
  await page.getByTestId('position-submit').click()
  // The cancel button only renders once the taken position is reflected.
  await expect(page.getByTestId('position-cancel')).toBeVisible()
}

/**
 * Forces the market's `locks_at` into the past via the backend's cypress-only time-travel helper
 * (`GET /__cypress__/lock_market?id=`). The market create form has minute granularity, so waiting
 * out a real lock would add a flaky minute per test.
 */
export async function lockMarket(marketId: number): Promise<void> {
  const response = await fetch(`${API_HOST}/__cypress__/lock_market?id=${String(marketId)}`)
  if (!response.ok) throw new Error(`lock_market failed with status ${String(response.status)}`)
}

/** Resolves a locked market to the named outcome and waits to land back on the market detail. */
export async function resolveMarket(
  page: Page,
  marketId: number,
  outcomeName: string,
): Promise<void> {
  await page.goto(`${GROUP_URL}/markets/${String(marketId)}/resolve`)
  await page.getByTestId('resolve-form').getByLabel(outcomeName, { exact: true }).check()
  await page.getByTestId('resolve-submit').click()
  await page.waitForURL(new RegExp(`/markets/${String(marketId)}(?:-[^/]*)?$`))
  await expect(page.getByTestId('market-resolved')).toBeVisible()
}

/**
 * Runs the whole Flow B trading round: the admin creates a YES/NO market and takes a $1 position
 * on YES, the member takes a $1 position on NO, the market locks, and the admin (as oracle)
 * resolves YES. Leaves the admin logged in on the resolved market's detail page and returns the
 * market's ID.
 */
export async function runTradingRound(page: Page, title: string): Promise<number> {
  await logInToGroup(page, ADMIN.email)
  const marketId = await createMarket(page, title)
  await placePosition(page, marketId, 'YES', '1')
  await logOut(page)

  await logInToGroup(page, MEMBER.email)
  await placePosition(page, marketId, 'NO', '1')
  await logOut(page)

  await lockMarket(marketId)

  await logInToGroup(page, ADMIN.email)
  await resolveMarket(page, marketId, 'YES')
  return marketId
}
