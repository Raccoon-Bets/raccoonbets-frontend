import { test, expect, fetchLastEmail, extractEmailPath } from './fixtures'

// Flow A locks the riskiest architecture under test: one SPA serving the apex
// and wildcard subdomains, with auth carried across hosts by apex-domain
// cookies. A fresh user signs up on the apex, verifies via the emailed link,
// creates a group, and lands on the group's subdomain still logged in.

const EMAIL = 'rocket@example.com'
const PASSWORD = 'supersecret'

test.describe('Flow A: signup → create group → subdomain SSO', () => {
  test('signs up, creates a group, and lands on its subdomain logged in', async ({
    page,
    baseURL,
    signUpPage,
    logInPage,
    groupsNewPage,
    resetDatabase: _reset,
  }) => {
    const slug = `den-${Date.now().toString(36)}`

    // ── Sign up on the apex ─────────────────────────────────────────────
    await signUpPage.visit()
    await signUpPage.fillName('Rocket Raccoon')
    await signUpPage.fillEmail(EMAIL)
    await signUpPage.fillPassword(PASSWORD)
    await signUpPage.submit()
    await expect(page.getByTestId('signup-success')).toBeVisible()

    // ── Verify the account via the emailed link ─────────────────────────
    const email = await fetchLastEmail()
    expect(email).not.toBeNull()

    // The backend's cypress frontend URL may differ from the Playwright
    // baseURL, so follow the link's path on our own host.
    await page.goto(extractEmailPath(email!, baseURL!))
    await expect(page.getByTestId('verify-account-success')).toBeVisible()

    // ── Log in (the verify view auto-redirects to login shortly) ────────
    await logInPage.visit()
    await logInPage.logIn(EMAIL, PASSWORD)

    // Login on the apex routes to the groups list; the fresh user has none.
    await expect(page.getByTestId('groups-empty')).toBeVisible()

    // ── Create a group ──────────────────────────────────────────────────
    await page.getByTestId('groups-new-link').click()
    await groupsNewPage.fillName('Trash Pandas')
    await groupsNewPage.fillSubdomain(slug)
    await expect(groupsNewPage.availability()).toHaveAttribute('data-status', 'available')
    await groupsNewPage.selectCurrency('USD')
    await groupsNewPage.submit()

    // ── Land on the new subdomain, still logged in ──────────────────────
    // Group creation performs a full page load on the subdomain, so this
    // exercises cookie hydration on a cold boot of the group app.
    await page.waitForURL(`http://${slug}.lvh.me:4173/`)
    await expect(page.getByTestId('feed-title')).toContainText(slug)
    await expect(page.getByTestId('group-current-user')).toContainText(EMAIL)
  })
})
