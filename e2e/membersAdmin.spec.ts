import type { Locator, Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { ADMIN, GROUP_URL, logInToGroup, MEMBER } from './helpers'

// Roster administration on /members: role changes, removal, and the
// last-admin business rule (the backend's 422 surfaces in the shared error
// line rather than orphaning the group).

function rosterRow(page: Page, name: string): Locator {
  return page.getByTestId('members-roster').locator('tr', { hasText: name })
}

function roleTag(row: Locator): Locator {
  return row.getByTestId(/^member-\d+-role$/)
}

async function visitMembersAsAdmin(page: Page): Promise<void> {
  await logInToGroup(page, ADMIN.email)
  await page.goto(`${GROUP_URL}/members`)
}

test.describe('Members admin: roles, removal, last-admin protection', () => {
  test('promotes a member to admin and demotes them back', async ({
    page,
    resetDatabase: _reset,
  }) => {
    await visitMembersAsAdmin(page)

    const row = rosterRow(page, MEMBER.name)
    await expect(roleTag(row)).toHaveText('Member')

    await row.getByRole('button', { name: 'Make admin' }).click()
    await expect(roleTag(row)).toHaveText('Admin')

    await row.getByRole('button', { name: 'Make member' }).click()
    await expect(roleTag(row)).toHaveText('Member')
  })

  test('removes a member from the roster', async ({ page, resetDatabase: _reset }) => {
    page.on('dialog', (dialog) => void dialog.accept())
    await visitMembersAsAdmin(page)

    await rosterRow(page, MEMBER.name).getByRole('button', { name: 'Remove' }).click()
    await expect(rosterRow(page, MEMBER.name)).toHaveCount(0)
    await expect(rosterRow(page, ADMIN.name)).toBeVisible()
  })

  test('the sole admin can neither demote nor remove themselves', async ({
    page,
    resetDatabase: _reset,
  }) => {
    page.on('dialog', (dialog) => void dialog.accept())
    await visitMembersAsAdmin(page)

    const me = rosterRow(page, ADMIN.name)
    await me.getByRole('button', { name: 'Make member' }).click()
    await expect(page.getByTestId('members-action-error')).toContainText(
      'A group must keep at least one admin.',
    )
    await expect(roleTag(me)).toHaveText('Admin')

    await me.getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByTestId('members-action-error')).toContainText(
      'A group must keep at least one admin.',
    )
    await expect(me).toBeVisible()
  })
})
