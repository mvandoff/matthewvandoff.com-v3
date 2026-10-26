import { expect, test } from '@playwright/test';
import { cloudflareAnalyticsToken } from '../../src/lib/analytics.ts';

// The beacon is in the built HTML exactly when the site token is set
// (src/lib/analytics.ts); while it is empty there is no script and no request.
test.describe('Cloudflare Web Analytics', () => {
  for (const path of ['/', '/no/such/page']) {
    test(`${path} has a beacon only when the site token is set`, async ({ request }) => {
      const html = await (await request.get(path)).text();
      expect(html.includes('cloudflareinsights')).toBe(cloudflareAnalyticsToken !== '');
    });
  }

  for (const path of ['/', '/no/such/page']) {
    test(`${path} runs its own scripts before the beacon`, async ({ request }) => {
      test.skip(cloudflareAnalyticsToken === '', 'the site token is empty');
      // Deferred and module scripts run in document order: the beacon must be last.
      const html = await (await request.get(path)).text();
      const scripts = html.match(/<script\b[^>]*>/g) ?? [];
      expect(scripts.at(-1)).toContain('cloudflareinsights');
    });
  }

  test('the page makes no analytics request while the token is empty', async ({ page }) => {
    test.skip(cloudflareAnalyticsToken !== '', 'the site token is set');
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(requests.filter((url) => /cloudflareinsights/.test(url))).toEqual([]);
  });
});
