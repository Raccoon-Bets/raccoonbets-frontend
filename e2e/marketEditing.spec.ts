import { test, expect } from './fixtures'
import {
  ADMIN,
  GROUP_URL,
  MEMBER,
  createMarket,
  locksAtValue,
  logInToGroup,
  logOut,
  placePosition,
} from './helpers'

// Market editing: the creator can change the title and description while the
// market is open, and the closing time only until the first position lands (the
// input freezes after that). Non-creators get no edit affordance at all.

test.describe('Market editing: creator only, locks_at frozen after the first position', () => {
  test('edits title, description, and locks_at, then locks_at freezes', async ({
    page,
    resetDatabase: _reset,
  }) => {
    await logInToGroup(page, ADMIN.email)
    const marketId = await createMarket(page, 'Will the first draft survive?')

    // ── With no positions, everything is editable ────────────────────────
    await page.getByTestId('market-edit-toggle').click()
    await expect(page.getByTestId('market-edit-locks-at')).toBeEnabled()
    await expect(page.getByTestId('market-edit-locks-frozen')).toHaveCount(0)

    await page.getByTestId('market-edit-title').fill('Will the second draft survive?')
    await page.getByTestId('market-edit-description').fill('The oracle judges at midnight.')
    await page.getByTestId('market-edit-locks-at').fill(locksAtValue(60))
    await page.getByTestId('market-edit-submit').click()

    await expect(page.getByTestId('market-edit-form')).toHaveCount(0)
    await expect(page.getByTestId('market-detail-title')).toHaveText(
      'Will the second draft survive?',
    )
    await expect(page.getByText('The oracle judges at midnight.')).toBeVisible()

    // ── After the first position, locks_at freezes but text stays editable ─
    await placePosition(page, marketId, 'YES', '1')
    await page.getByTestId('market-edit-toggle').click()
    await expect(page.getByTestId('market-edit-locks-at')).toBeDisabled()
    await expect(page.getByTestId('market-edit-locks-frozen')).toBeVisible()

    await page.getByTestId('market-edit-title').fill('Will the final draft survive?')
    await page.getByTestId('market-edit-submit').click()
    await expect(page.getByTestId('market-edit-form')).toHaveCount(0)
    await expect(page.getByTestId('market-detail-title')).toHaveText(
      'Will the final draft survive?',
    )
  })

  test('a non-creator sees no edit affordance', async ({ page, resetDatabase: _reset }) => {
    await logInToGroup(page, ADMIN.email)
    const marketId = await createMarket(page, 'Whose market is this anyway?')
    await logOut(page)

    await logInToGroup(page, MEMBER.email)
    await page.goto(`${GROUP_URL}/markets/${String(marketId)}`)
    await expect(page.getByTestId('market-detail-title')).toHaveText('Whose market is this anyway?')
    // The page is fully interactive (the order slip renders) yet offers no edit.
    await expect(page.getByTestId('order-slip')).toBeVisible()
    await expect(page.getByTestId('market-edit-toggle')).toHaveCount(0)
  })
})

test.describe('Market URL canonicalization', () => {
  test('bare-id and stale-slug URLs redirect to the canonical {id}-{slug}', async ({
    page,
    resetDatabase: _reset,
  }) => {
    await logInToGroup(page, ADMIN.email)
    const marketId = await createMarket(page, 'Who wins the Super Bowl?')
    const canonical = `/markets/${String(marketId)}-who-wins-the-super-bowl`

    // createMarket lands directly on the canonical URL.
    await expect(page).toHaveURL(new RegExp(`${canonical}$`))

    // A bare-id link is corrected to the canonical slug.
    await page.goto(`${GROUP_URL}/markets/${String(marketId)}`)
    await expect(page).toHaveURL(new RegExp(`${canonical}$`))
    await expect(page.getByTestId('market-detail-title')).toHaveText('Who wins the Super Bowl?')

    // A stale/wrong slug is corrected to the live title.
    await page.goto(`${GROUP_URL}/markets/${String(marketId)}-old-and-wrong`)
    await expect(page).toHaveURL(new RegExp(`${canonical}$`))
  })
})
