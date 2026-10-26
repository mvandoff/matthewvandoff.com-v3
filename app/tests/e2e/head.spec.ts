import { expect, test, type Page } from '@playwright/test';

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

test.describe('share previews', () => {
  /** The content of the head meta tag with this property or name. */
  const meta = (page: Page, key: string) =>
    page.locator(`meta[property="${key}"], meta[name="${key}"]`).getAttribute('content');

  test('the home page has Open Graph and Twitter card tags from the site meta', async ({ page }) => {
    await page.goto('/');
    expect(await meta(page, 'og:type')).toBe('website');
    expect(await meta(page, 'og:title')).toBe('matthew van doff');
    expect(await meta(page, 'og:description')).toBe(await meta(page, 'description'));
    expect(await meta(page, 'og:url')).toBe(`${origin}/`);
    expect(await meta(page, 'og:image')).toBe(`${origin}/og-image.png`);
    expect(await meta(page, 'og:image:width')).toBe('1200');
    expect(await meta(page, 'og:image:height')).toBe('630');
    expect(await meta(page, 'og:image:alt')).toMatch(/matthew van doff/);
    expect(await meta(page, 'twitter:card')).toBe('summary_large_image');
  });

  test('the share image is a 1200×630 PNG served by the site', async ({ request }) => {
    const response = await request.get('/og-image.png');
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toBe('image/png');
    const png = await response.body();
    // The IHDR chunk: width and height are the big-endian words at bytes 16 and 20.
    expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });

  test('the 404 page has share tags but no og:url', async ({ page }) => {
    await page.goto('/no/such/page');
    expect(await meta(page, 'og:title')).toBe('not found · matthew van doff');
    expect(await meta(page, 'og:image')).toBe(`${origin}/og-image.png`);
    await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
  });
});
