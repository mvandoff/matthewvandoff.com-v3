import { expect, test } from '@playwright/test';

test('the head has the title, a one-line description and the favicon', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('matthew van doff');
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description).toMatch(/software developer/);
  expect(description).not.toMatch(/\n/);
  const favicon = page.locator('link[rel="icon"]');
  await expect(favicon).toHaveAttribute('href', '/favicon.svg');
  const response = await page.request.get('/favicon.svg');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('svg');
});

test('fonts are served by the site itself, with no Google Fonts requests', async ({ page, baseURL }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  expect(requests.filter((url) => /fonts\.(googleapis|gstatic)\.com/.test(url))).toEqual([]);

  const fontRequests = requests.filter((url) => /\.(woff2?|ttf|otf)(\?|$)/.test(url));
  expect(fontRequests.length).toBeGreaterThan(0);
  for (const url of fontRequests) expect(url.startsWith(baseURL!)).toBe(true);

  const loaded = await page.evaluate(() =>
    [...document.fonts].filter((font) => font.status === 'loaded').map((font) => font.family.replace(/"/g, '')),
  );
  expect(loaded).toEqual(expect.arrayContaining(['Gridular', 'Martian Mono', 'DotGothic16']));
});

test('Gridular and Martian Mono are preloaded; Geist is neither preloaded nor fetched on desktop', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  const preloads = await page
    .locator('link[rel="preload"][as="font"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  expect(preloads.some((href) => /gridular/i.test(href ?? ''))).toBe(true);
  expect(preloads.some((href) => /martian/i.test(href ?? ''))).toBe(true);
  expect(preloads.some((href) => /geist/i.test(href ?? ''))).toBe(false);
  expect(requests.filter((url) => /geist/i.test(url))).toEqual([]);
});

test('the links Section points at the real profiles', async ({ page }) => {
  await page.goto('/');
  const links = page.locator('section#links');
  await expect(links.getByRole('link', { name: 'github' })).toHaveAttribute(
    'href',
    /^https:\/\/github\.com\/mvandoff\/?$/,
  );
  await expect(links.getByRole('link', { name: 'linkedin' })).toHaveAttribute(
    'href',
    /^https:\/\/(www\.)?linkedin\.com\/in\/matthew-vandoff\/?$/,
  );
});

test('the footer shows the current year', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer')).toContainText(`© ${new Date().getFullYear()} matthew van doff`);
});

test('the footer year follows the visitor\'s clock, not the build date', async ({ page }) => {
  await page.clock.install({ time: new Date(2041, 5, 1, 12, 0, 0) });
  await page.goto('/');
  await expect(page.locator('footer')).toContainText('© 2041 matthew van doff');
});
