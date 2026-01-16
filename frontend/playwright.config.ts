/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 10_000,
  fullyParallel: true,
  reporter: [['html', { open: 'never' }], ['list']],
  workers: 1,

  use: {
    launchOptions: {
      devtools: true,
    },
    storageState: 'playwright/.auth/auth.json',
    baseURL: 'http://localhost:5173',
    headless: true, // false = you see everything, no flakes
    viewport: { width: 1280, height: 800 },
    screenshot: (process.env.PW_USE_SCREENSHOT as 'on' | 'off' | 'only-on-failure') || 'only-on-failure',
    video: (process.env.PW_USE_VIDEO as 'on' | 'off' | 'retain-on-failure' | 'retain-on-failure') || 'retain-on-failure',
    trace: (process.env.PW_USE_TRACE as 'on' | 'off' | 'retain-on-failure' | 'on-first-retry') || 'on-first-retry',

    // THIS IS THE ONLY LINE THAT MATTERS
  },
  projects: [
    {
      name: 'e2e headless',
      use: {
        ...devices['Desktop Chrome'],
        headless: true, // can be modified just in case
        // plus anything else (viewport, baseURL, permissions, etc.)
      },
    },
  ],

  webServer: [
    {
      command: 'npm run dev:e2e',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
})
