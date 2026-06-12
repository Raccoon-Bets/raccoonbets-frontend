import { test, expect } from './fixtures'
import { ADMIN, GROUP_URL, logInOnApex, PASSWORD, submitAndConfirm } from './helpers'

// Subdomain edge cases: unknown slugs route to the missing-group view, the
// group-creation form blocks bad/reserved/taken addresses, and a logged-out
// visit to a group redirects to login on that same subdomain.

test.describe('Subdomains: unknown slugs, availability, login redirects', () => {
  test('an unknown subdomain shows the missing-group view', async ({
    page,
    resetDatabase: _reset,
  }) => {
    // The session cookie spans *.lvh.me, so log in on the apex first.
    await logInOnApex(page, ADMIN.email)

    await page.goto('http://no-such-den.lvh.me:4173/')
    await page.waitForURL('**/missing-group')
    await expect(page.getByRole('heading', { name: 'No group here' })).toBeVisible()
  })

  test('group creation blocks invalid, reserved, and taken subdomains', async ({
    page,
    groupsNewPage,
    resetDatabase: _reset,
  }) => {
    await logInOnApex(page, ADMIN.email)
    await groupsNewPage.visit()
    await groupsNewPage.fillName('Some Den')

    const submit = page.getByTestId('group-submit')

    await groupsNewPage.fillSubdomain('-bad')
    await expect(groupsNewPage.availability()).toHaveAttribute('data-status', 'invalid')
    await expect(submit).toBeDisabled()

    await groupsNewPage.fillSubdomain('www')
    await expect(groupsNewPage.availability()).toHaveAttribute('data-status', 'reserved')
    await expect(submit).toBeDisabled()

    await groupsNewPage.fillSubdomain('cypress-den')
    await expect(groupsNewPage.availability()).toHaveAttribute('data-status', 'taken')
    await expect(submit).toBeDisabled()
  })

  test('the subdomain autofills from the group name until the user edits it', async ({
    page,
    groupsNewPage,
    resetDatabase: _reset,
  }) => {
    await logInOnApex(page, ADMIN.email)
    await groupsNewPage.visit()

    const subdomain = page.getByTestId('group-subdomain')

    await groupsNewPage.fillName('Trash Pandas')
    await expect(subdomain).toHaveValue('trash-pandas')

    // Once the user picks their own address, further name edits leave it alone.
    await groupsNewPage.fillSubdomain('my-den')
    await groupsNewPage.fillName('Garbage Goblins')
    await expect(subdomain).toHaveValue('my-den')

    // Clearing it back out resumes suggestions rather than leaving it blank.
    await groupsNewPage.fillSubdomain('')
    await groupsNewPage.fillName('Sneaky Squirrels')
    await expect(subdomain).toHaveValue('sneaky-squirrels')
  })

  test('a logged-out group visit redirects to login on the subdomain, then back to the intended page', async ({
    page,
    resetDatabase: _reset,
  }) => {
    await page.goto(`${GROUP_URL}/members`)
    await page.waitForURL(`${GROUP_URL}/login`)

    await page.getByTestId('login-email').fill(ADMIN.email)
    await page.getByTestId('login-password').fill(PASSWORD)

    // Login on a group host with a return-to path goes back to that page.
    await submitAndConfirm(page.getByTestId('login-submit'), async () => {
      await page.waitForURL(`${GROUP_URL}/members`, { timeout: 5000 })
    })
    await expect(page.getByTestId('members-roster')).toBeVisible()
  })
})
