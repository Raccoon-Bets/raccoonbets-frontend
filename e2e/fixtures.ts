import { test as base } from '@playwright/test'
import { SignUpPage } from './pages/SignUpPage'
import { LogInPage } from './pages/LogInPage'
import { GroupsNewPage } from './pages/GroupsNewPage'

// The cypress-environment backend from Procfile.e2e, bound to 127.0.0.1:5000.
// Fixture/helper requests go straight to it (no CORS involved); the SPA
// itself talks to the same server as http://api.lvh.me:5000 per .env.test.
const API_HOST = 'http://127.0.0.1:5000'

type Fixtures = {
  signUpPage: SignUpPage
  logInPage: LogInPage
  groupsNewPage: GroupsNewPage
  resetDatabase: string
}

export const test = base.extend<Fixtures>({
  /**
   * Resets the backend to a known state: a single verified user
   * (`cypress@example.com` / `supersecret`) who is the admin of one group
   * ("Cypress Den" at `cypress-den`). Resolves to the seeded user's email.
   */
  // eslint-disable-next-line no-empty-pattern
  resetDatabase: async ({}, use) => {
    const response = await fetch(`${API_HOST}/__cypress__/reset`)
    const email = await response.text()
    await use(email)
  },

  signUpPage: async ({ page }, use) => {
    await use(new SignUpPage(page))
  },

  logInPage: async ({ page }, use) => {
    await use(new LogInPage(page))
  },

  groupsNewPage: async ({ page }, use) => {
    await use(new GroupsNewPage(page))
  },
})

/** Fetches and parses the last email the backend sent, or `null` if none was sent. */
export async function fetchLastEmail(): Promise<{
  html: string
  text: string
} | null> {
  const response = await fetch(`${API_HOST}/__cypress__/last_email`)
  if (response.status !== 200) return null

  const { default: PostalMime } = await import('postal-mime')
  const raw = await response.text()
  const parsed = await PostalMime.parse(raw)
  return { html: parsed.html ?? '', text: parsed.text ?? '' }
}

/** Extracts the first link from an email body as an absolute URL. */
export function extractEmailURL(body: { html: string; text: string }): string {
  // Try an HTML anchor first, then fall back to any URL in the plain-text body.
  const hrefMatch = /href="([^"]+)"/.exec(body.html)
  if (hrefMatch) return hrefMatch[1]

  const urlMatch = /https?:\/\/\S+/.exec(body.text || body.html)
  if (!urlMatch) throw new Error('No link found in email')
  return urlMatch[0]
}

/**
 * Extracts the first link from an email body as a path + query relative to `baseURL`, so the
 * test can follow it regardless of which frontend host the backend was configured with.
 */
export function extractEmailPath(body: { html: string; text: string }, baseURL: string): string {
  const url = new URL(extractEmailURL(body), baseURL)
  return url.pathname + url.search
}

export { expect } from '@playwright/test'
