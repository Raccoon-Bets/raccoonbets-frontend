import { defineConfig, devices } from '@playwright/test'

/**
 * Minimal Playwright scaffold — e2e specs arrive in Phase 7. lvh.me resolves
 * to 127.0.0.1, so the wildcard-subdomain tenancy flows can be exercised
 * against the preview server.
 */
export default defineConfig({
  testDir: './e2e',
  /* Tests will share a single backend DB reset per-test, so parallel
     execution would cause race conditions. */
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://lvh.me:4173',
    trace: 'on-first-retry',
  },
  /* TODO: temporarily Chromium-only to keep the suite fast during initial
     development — re-enable firefox/webkit before launch:
     { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
     { name: 'webkit', use: { ...devices['Desktop Safari'] } }, */
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  /* Only the SPA preview is booted here. The backend stack — Rails in the
     `cypress` env (with the __cypress__ reset/last_email/lock_prop middlewares)
     and the AnyCable pair for the realtime specs — is owned by
     `overmind start -f Procfile.e2e`, which runs this suite once it is up.
     reuseExistingServer means the preview Procfile.e2e starts is reused rather
     than a second copy being launched. */
  webServer: {
    command: 'vite build --mode test && vite preview --port 4173',
    url: 'http://lvh.me:4173',
    reuseExistingServer: !process.env.CI,
  },
})
