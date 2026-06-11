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
  /* The full stack: SPA preview, Rails API (cypress env, with the __cypress__
     reset/last_email/lock_prop middlewares), and the AnyCable pair for the
     realtime specs. Each entry is skipped when something is already listening
     (reuseExistingServer), so `overmind start -f Procfile.e2e` keeps working. */
  webServer: [
    {
      command: 'vite build --mode test && vite preview --port 4173',
      url: 'http://lvh.me:4173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        'bash -c "source ~/.rvm/scripts/rvm && rvm 4.0.5@raccoonbets exec rails server -e cypress -b 127.0.0.1 -p 5000"',
      cwd: '../Backend',
      url: 'http://127.0.0.1:5000/up',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        'bash -c "source ~/.rvm/scripts/rvm && RAILS_ENV=cypress rvm 4.0.5@raccoonbets exec anycable"',
      cwd: '../Backend',
      port: 50051,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        'bash -c "source ~/.rvm/scripts/rvm && rvm 4.0.5@raccoonbets exec bin/anycable-go --port=8080"',
      cwd: '../Backend',
      url: 'http://127.0.0.1:8080/health',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
