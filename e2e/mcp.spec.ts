import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { test, expect } from './fixtures'

const api = process.env.E2E_API_URL ?? 'http://127.0.0.1:5000'
const callback = 'https://assistant.example/callback'

async function startAssistantConnection(): Promise<{
  clientId: string
  verifier: string
  consentURL: string
}> {
  const registration = await fetch(`${api}/oauth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Browser test assistant',
      redirect_uris: [callback],
      token_endpoint_auth_method: 'none',
    }),
  })
  const { client_id: clientId } = z
    .object({ client_id: z.string() })
    .parse(await registration.json())
  const verifier = randomBytes(48).toString('base64url')
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callback,
    resource: `${api}/mcp`,
    response_type: 'code',
    scope: 'mcp:read mcp:write',
    state: 'browser-state',
    code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
  })
  const response = await fetch(`${api}/oauth/authorize?${query.toString()}`, { redirect: 'manual' })
  const consentURL = response.headers.get('location')
  if (!consentURL) throw new Error(`Authorization failed: ${await response.text()}`)
  return { clientId, verifier, consentURL }
}

async function exchangeCode(clientId: string, verifier: string, code: string): Promise<string> {
  const response = await fetch(`${api}/oauth/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      code_verifier: verifier,
      redirect_uri: callback,
      resource: `${api}/mcp`,
    }),
  })
  return z.object({ access_token: z.string() }).parse(await response.json()).access_token
}

async function listGroups(token: string): Promise<Response> {
  return fetch(`${api}/mcp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'list_groups', arguments: {} },
    }),
  })
}

test('authorizes selected groups through login and revokes the assistant from the account screen', async ({
  page,
  logInPage,
  resetDatabase,
  baseURL,
}) => {
  const { clientId, verifier, consentURL } = await startAssistantConnection()
  await page.route(`${callback}**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>Assistant connected</p>' }),
  )
  await page.goto(consentURL)
  await expect(page.getByTestId('login-email')).toBeVisible()
  await logInPage.logIn(resetDatabase, 'supersecret', async () => {
    await expect(page.getByRole('heading', { name: 'Connect your assistant' })).toBeVisible()
  })
  await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeDisabled()
  await page.getByLabel('Cypress Den', { exact: true }).check()
  await expect(page.getByLabel('Allow actions on my behalf')).not.toBeChecked()
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await page.waitForURL(`${callback}**`)
  const query = new URL(page.url()).searchParams
  expect(query.get('state')).toBe('browser-state')
  const code = query.get('code')
  if (!code) throw new Error('No authorization code returned')
  const token = await exchangeCode(clientId, verifier, code)
  const groups = await listGroups(token)
  expect(groups.ok).toBe(true)
  expect(await groups.text()).toContain('cypress-den')
  await page.goto(`${baseURL ?? 'http://lvh.me:4173'}/account`)
  await expect(page.getByRole('heading', { name: 'Browser test assistant' })).toBeVisible()
  await page.getByRole('button', { name: 'Revoke access' }).click()
  await expect(page.getByText('Revoked', { exact: true })).toBeVisible()
  expect((await listGroups(token)).status).toBe(401)
})
