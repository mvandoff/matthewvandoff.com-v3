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

test('with a file missing, np shows no mock data (what it shows instead is mvd-tt6)', async ({ page }) => {
  await serveSamples(page, ['recent.json']);
  await page.goto('/');
  const t = terminal(page);
  await t.run('np');
  await expect(page.getByText('· mock data')).toHaveCount(0);
  await expect(t.body).not.toContainText('now playing');
  // Still the build's idle status, whose placeholder track the files refresh could not replace.
  await expect(t.body.locator('dd').nth(1)).toContainText('[track title]');
});
