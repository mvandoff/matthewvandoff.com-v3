import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { terminal } from '../helpers/terminal.ts';

/**
 * Runs against a build with the files music source (the `music-files` project), with
 * the sample files served from tests/fixtures/music/ (built from the last.fm fixtures by
 * the real mapping). The mock-source specs are in music.spec.ts.
 */

/** Serves /music/*.json from the samples, as the site's own origin will. */
async function serveSamples(page: Page, skip: string[] = []) {
  await page.route('**/music/*.json', async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!;
    if (skip.includes(name)) return route.fulfill({ status: 404 });
    const path = new URL(`../fixtures/music/${name}`, import.meta.url);
    await route.fulfill({ contentType: 'application/json', body: await readFile(path) });
  });
}

test.beforeEach(async ({ page }) => {
  // The samples were fetched at 12:00Z; the visitor arrives five minutes later.
  await page.clock.setFixedTime(new Date('2026-10-19T12:05:00Z'));
});

test('np shows the sample files\' playing track, with no mock data label', async ({ page }) => {
  await serveSamples(page);
  await page.goto('/');
  const t = terminal(page);
  await t.run('np');
  await expect.poll(() => t.lines()).toEqual([
    '▶ Spoonman — Soundgarden',
    '  now playing',
  ]);
  await expect(t.header).toContainText('last.fm');
  await expect(t.header).not.toContainText('mock data');
});

test('top tracks --week reads the sample file, with no mock data label', async ({ page }) => {
  await serveSamples(page);
  await page.goto('/');
  const t = terminal(page);
  await t.run('top tracks --week');
  await expect(t.body.locator('.t-row').first()).toContainText('What You Are — Audioslave');
  await expect(t.header).toContainText('top tracks · 7 days');
  await expect(t.header).not.toContainText('mock data');
});

test('recent lists the sample tracks, with no mock data label', async ({ page }) => {
  await serveSamples(page);
  await page.goto('/');
  const t = terminal(page);
  await t.run('recent');
  await expect.poll(async () => (await t.lines())[0]).toBe('now  Spoonman — Soundgarden');
  await expect(t.header).not.toContainText('mock data');
});

test('the idle status is refreshed from the files on load', async ({ page }) => {
  await serveSamples(page);
  await page.goto('/');
  await expect(terminal(page).body.locator('dd').nth(1)).toContainText('Spoonman — Soundgarden');
});

/** How often the listening line rereads the music data (LISTENING_REFRESH_MS in the controller). */
const REFRESH_MS = 30_000;

/** Serves recent.json with just `track` playing, in place of the sample. */
async function servePlaying(page: Page, track: { title: string; artist: string; art?: { thumb: string; full: string } }) {
  await page.unroute('**/music/recent.json');
  await page.route('**/music/recent.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ fetchedAt: '2026-10-19T12:00:00.000Z', tracks: [{ track, playing: true, at: null }] }),
    }),
  );
}

test('the idle status follows a track change without a reload', async ({ page }) => {
  await serveSamples(page);
  await page.goto('/');
  const listening = terminal(page).body.locator('dd').nth(1);
  await expect(listening).toContainText('Spoonman — Soundgarden');
  await servePlaying(page, { title: 'Black Hole Sun', artist: 'Soundgarden' });
  await page.clock.runFor(REFRESH_MS);
  await expect(listening).toContainText('Black Hole Sun — Soundgarden');
});

test('a hidden page reads no music data, and refreshes as soon as it is shown again', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => ((window as { testHidden?: boolean }).testHidden ? 'hidden' : 'visible'),
    });
  });
  const setHidden = (hidden: boolean) =>
    page.evaluate((hidden) => {
      (window as { testHidden?: boolean }).testHidden = hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  let reads = 0;
  page.on('request', (req) => {
    if (req.url().endsWith('/music/recent.json')) reads++;
  });
  await serveSamples(page);
  await page.goto('/');
  const listening = terminal(page).body.locator('dd').nth(1);
  await expect(listening).toContainText('Spoonman — Soundgarden');
  expect(reads).toBe(1);

  await setHidden(true);
  await servePlaying(page, { title: 'Black Hole Sun', artist: 'Soundgarden' });
  await page.clock.runFor(REFRESH_MS * 3);
  expect(reads).toBe(1);
  await expect(listening).toContainText('Spoonman — Soundgarden');

  await setHidden(false);
  await expect(listening).toContainText('Black Hole Sun — Soundgarden');
  expect(reads).toBe(2);
});

test('when the new track\'s art fails to load, the header shows its kana', async ({ page }) => {
  // A 1×1 PNG stands in for last.fm's art; broken.png is missing.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  await page.route('https://art.test/**', (route) =>
    route.request().url().endsWith('/broken.png')
      ? route.fulfill({ status: 404 })
      : route.fulfill({ contentType: 'image/png', body: png }),
  );
  await serveSamples(page);
  await servePlaying(page, {
    title: 'Spoonman',
    artist: 'Soundgarden',
    art: { thumb: 'https://art.test/a.png', full: 'https://art.test/a-full.png' },
  });
  await page.goto('/');
  const t = terminal(page);
  const art = t.header.locator('.sig-art');
  const kana = t.header.locator('.sig-kana');
  await expect(art).toBeVisible();
  await expect(kana).toBeHidden();

  await servePlaying(page, {
    title: 'Black Hole Sun',
    artist: 'Soundgarden',
    art: { thumb: 'https://art.test/broken.png', full: 'https://art.test/broken.png' },
  });
  await page.clock.runFor(REFRESH_MS);
  await expect(t.body.locator('dd').nth(1)).toContainText('Black Hole Sun — Soundgarden');
  await expect(kana).toBeVisible();
  await expect(art).toBeHidden();
});

test('with a file missing, np says it couldn\'t load the data, and the idle status keeps its placeholder', async ({ page }) => {
  await serveSamples(page, ['recent.json']);
  await page.goto('/');
  const t = terminal(page);
  const listening = t.body.locator('dd').nth(1);
  await expect(listening).toHaveText('—');
  await t.run('np');
  await expect.poll(() => t.lines()).toEqual(["np: couldn't load music data  · try again later"]);
  await expect(page.getByText('· mock data')).toHaveCount(0);
  await t.input.press('Escape');
  await expect(listening).toHaveText('—');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the idle status shows a placeholder, not a made-up track', async ({ page }) => {
    await serveSamples(page);
    await page.goto('/');
    await expect(terminal(page).body.locator('dd').nth(1)).toHaveText('—');
  });
});
