import { defineConfig, devices } from '@playwright/test';

const port = 4329;
/** A second build and preview, with the files music source (see src/lib/music/index.ts). */
const filesPort = 4330;

/**
 * Behaviour tests run against `astro preview` of a fresh production build.
 * Desktop is the default project; phone-width specs set their own viewport. Its build
 * uses the mock music source; the `music-files` project runs against a build that reads
 * music files, which its spec serves from the sample files.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  // Headroom for a loaded machine (many workers, or a busy laptop). Timing assertions
  // are all driven by fake clocks, so this changes how long a slow run may take, never
  // what passes.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    // Once the analytics token is set (src/lib/analytics.ts), pages carry the Cloudflare
    // beacon. Its hosts don't resolve here, so tests never reach the network or report
    // test visits; the beacon fails to load, as it does behind an ad blocker.
    launchOptions: {
      args: ['--host-resolver-rules=MAP static.cloudflareinsights.com ~NOTFOUND, MAP cloudflareinsights.com ~NOTFOUND'],
    },
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: 'music-files.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'music-files',
      testMatch: 'music-files.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: `http://127.0.0.1:${filesPort}` },
    },
  ],
  webServer: [
    {
      // astro is invoked directly (not via pnpm) so stopping the server stops astro
      // too. --ignore-lock keeps preview in the foreground: Astro otherwise
      // backgrounds it when it detects an AI agent, and Playwright loses track of it.
      command: `PUBLIC_MUSIC_SOURCE=mock astro build && astro preview --ignore-lock --host 127.0.0.1 --port ${port}`,
      url: `http://127.0.0.1:${port}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `ASTRO_OUT_DIR=dist-files PUBLIC_MUSIC_SOURCE=files astro build && ASTRO_OUT_DIR=dist-files astro preview --ignore-lock --host 127.0.0.1 --port ${filesPort}`,
      url: `http://127.0.0.1:${filesPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
