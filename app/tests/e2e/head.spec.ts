import { expect, test } from '@playwright/test';

const origin = 'https://www.matthewvandoff.com';

test.describe('crawling', () => {
  test('the home page has a canonical URL on the www origin and is indexable', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${origin}/`);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test('the 404 page is noindex and has no canonical URL', async ({ page }) => {
    await page.goto('/no/such/page');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });

  test('robots.txt allows everything and points at the sitemap', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('text/plain');
    const lines = (await response.text()).split('\n');
    expect(lines).toContain('User-agent: *');
    expect(lines).toContain('Allow: /');
    expect(lines.some((line) => /^Disallow:\s*\S/.test(line))).toBe(false);
    expect(lines).toContain(`Sitemap: ${origin}/sitemap.xml`);
  });

  test('the sitemap lists the home page and nothing else', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('xml');
    const xml = await response.text();
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect([...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1])).toEqual([`${origin}/`]);
  });
});
