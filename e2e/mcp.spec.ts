import { test, expect } from './fixtures'
import {
  APEX_URL,
  ASSISTANT_CALLBACK,
  GROUP,
  PASSWORD,
  callAssistantTool,
  exchangeAssistantCode,
  startAssistantConnection,
} from './helpers'

test('authorizes selected groups through login and revokes the assistant from the account screen', async ({
  page,
  logInPage,
  resetDatabase,
}) => {
  const assistant = await startAssistantConnection('Browser test assistant')
  await page.route(`${ASSISTANT_CALLBACK}**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>Assistant connected</p>' }),
  )
  await page.goto(assistant.consentURL)
  await expect(page.getByTestId('login-email')).toBeVisible()
  await logInPage.logIn(resetDatabase, PASSWORD, async () => {
    await expect(page.getByRole('heading', { name: 'Connect your assistant' })).toBeVisible()
  })
  await expect(page.getByTestId('mcp-consent-host')).toHaveText('assistant.example')
  await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeDisabled()
  await page.getByLabel(GROUP.name, { exact: true }).check()
  await expect(page.getByLabel('Allow actions on my behalf')).not.toBeChecked()
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await page.waitForURL(`${ASSISTANT_CALLBACK}**`)
  const query = new URL(page.url()).searchParams
  expect(query.get('state')).toBe('browser-state')
  const code = query.get('code')
  if (!code) throw new Error('No authorization code returned')
  const token = await exchangeAssistantCode(assistant, code)
  const groups = await callAssistantTool(token, 'list_groups')
  expect(groups.ok).toBe(true)
  expect(await groups.text()).toContain(GROUP.slug)

  await page.goto(`${APEX_URL}/account`)
  await expect(page.getByRole('heading', { name: 'Browser test assistant' })).toBeVisible()
  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('button', { name: 'Revoke access for Browser test assistant' }).click()
  await expect(page.getByText('Browser test assistant no longer has access.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Browser test assistant' })).toBeHidden()
  expect((await callAssistantTool(token, 'list_groups')).status).toBe(401)
})
