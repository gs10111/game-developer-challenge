import { defineConfig, devices } from '@playwright/test';

const previewUrl = 'http://localhost:4173';
const runsInCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: runsInCi,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: previewUrl,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7 landscape'] } },
  ],
  webServer: {
    command: 'pnpm build && pnpm preview',
    url: previewUrl,
    reuseExistingServer: !runsInCi,
    timeout: 120_000,
  },
});
