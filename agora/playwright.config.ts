import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright Test configuration for Agora E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],

  use: {
    // App runs at /agora base path
    baseURL: process.env.BASE_URL || 'http://localhost:3000/agora',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],

  // Run local dev server before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/agora',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000 // 3 min for CI cold start
  }
})
