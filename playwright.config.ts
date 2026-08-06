import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  timeout: 30_000,
  expect: { timeout: 3_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
    trace: 'retain-on-failure',
  },
  webServer: { command: 'bun run build && bun run preview --host 127.0.0.1', port: 4173, reuseExistingServer: true },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
