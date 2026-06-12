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

// Market editing: the creator (or a group admin) can change the title,
// description, and closing time while the market is open — even after
// positions exist (holders are emailed instead of the field freezing).
// Members who are neither get no edit affordance at all.

test.describe('Market editing: creator or admin, while open', () => {
  test('the creator edits title, description, and locks_at, even after a position lands', async ({
    page,
    resetDatabase: _reset,
  }) => {
    await logInToGroup(page, ADMIN.email)
    const marketId = await createMarket(page, 'Will the first draft survive?')

    await page.getByTestId('market-edit-toggle').click()
    await page.getByTestId('market-edit-title').fill('Will the second draft survive?')
    await page.getByTestId('market-edit-description').fill('The oracle judges at midnight.')
    await page.getByTestId('market-edit-locks-at').fill(locksAtValue(60))
    await page.getByTestId('market-edit-submit').click()

    await expect(page.getByTestId('market-edit-form')).toHaveCount(0)
    await expect(page.getByTestId('market-detail-title')).toHaveText(
      'Will the second draft survive?',
    )
    await expect(page.getByText('The oracle judges at midnight.')).toBeVisible()

    // locks_at stays editable after the first position lands.
    await placePosition(page, marketId, 'YES', '1')
    await page.getByTestId('market-edit-toggle').click()
    await expect(page.getByTestId('market-edit-locks-at')).toBeEnabled()
    await page.getByTestId('market-edit-locks-at').fill(locksAtValue(90))
    await page.getByTestId('market-edit-submit').click()
    await expect(page.getByTestId('market-edit-form')).toHaveCount(0)
  })

  test('a member who is neither creator nor admin sees no edit affordance', async ({
    page,
    resetDatabase: _reset,
  }) => {
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

test.describe('Admin market tools', () => {
  test('an admin edits another member’s market, cancels a position, and deletes the market', async ({
    page,
    resetDatabase: _reset,
  }) => {
    page.on('dialog', (dialog) => void dialog.accept())

    // The plain member creates a market and takes a position on it.
    await logInToGroup(page, MEMBER.email)
    const marketId = await createMarket(page, 'Will the admin tidy this up?')
    await placePosition(page, marketId, 'YES', '1')
    await logOut(page)

    // The admin — not the creator — gets the edit affordance and uses it.
    await logInToGroup(page, ADMIN.email)
    await page.goto(`${GROUP_URL}/markets/${String(marketId)}`)
    await page.getByTestId('market-edit-toggle').click()
    await expect(page.getByTestId('market-edit-locks-at')).toBeEnabled()
    await page.getByTestId('market-edit-title').fill('Will the admin tidy this up? (edited)')
    await page.getByTestId('market-edit-locks-at').fill(locksAtValue(90))
    await page.getByTestId('market-edit-submit').click()
    await expect(page.getByTestId('market-detail-title')).toHaveText(
      'Will the admin tidy this up? (edited)',
    )

    // Cancel the member's position (the confirm dialog is auto-accepted).
    await page.locator('[data-testid$="-admin-cancel"]').click()
    await expect(page.getByTestId('positions-empty')).toBeVisible()

    // Delete the market and land back on the feed, where it is gone.
    await page.getByTestId('market-delete').click()
    await page.waitForURL(`${GROUP_URL}/`)
    await expect(page.getByTestId('feed-title')).toBeVisible()
    await expect(page.getByText('Will the admin tidy this up? (edited)')).toHaveCount(0)
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
