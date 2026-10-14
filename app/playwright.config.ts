import { defineConfig, devices } from '@playwright/test';

const port = 4329;

/**
 * Behaviour tests run against `astro preview` of a fresh production build.
 * Desktop is the default project; phone-width specs set their own viewport.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    // astro is invoked directly (not via pnpm) so stopping the server stops astro
    // too. --ignore-lock keeps preview in the foreground: Astro otherwise
    // backgrounds it when it detects an AI agent, and Playwright loses track of it.
    command: `astro build && astro preview --ignore-lock --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
