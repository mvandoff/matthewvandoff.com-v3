import { expect, test, type Page } from '@playwright/test';
import { terminal } from '../helpers/terminal.ts';

/** Teal Accent (#8fb3ad); the second colour equals it in the mono palette. */
const ACCENT = 'rgb(143, 179, 173)';
const DIM = 'rgb(150, 146, 160)';

const top = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!.y;

/** Large output expands the Terminal over the Name card on desktop. */
async function expectExpanded(page: Page) {
  const nameCardTop = await top(page, '.cel.lead');
  await expect.poll(() => top(page, '.cel.sig')).toBeCloseTo(nameCardTop, 0);
  await expect(page.locator('.cel.lead')).toHaveCSS('opacity', '0');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('the idle status names the last played track with " · 2h ago" and no EQ', async ({ page }) => {
  const listening = terminal(page).body.locator('dd').nth(1);
  await expect(listening).toHaveText('[track title] — [artist] · 2h ago');
  await expect(listening.locator('[aria-hidden="true"]')).toHaveCount(0);
});

test('top tracks --week shows 25 ranked bar rows with the meta line, expanded', async ({ page }) => {
  const t = terminal(page);
  await t.run('top tracks --week');
  const rows = t.body.locator('.t-row');
  await expect(rows).toHaveCount(25);
  const cells = await rows.evaluateAll((els) =>
    els.map((el) => [...el.children].map((c) => (c as HTMLElement).innerText)),
  );
  expect(cells[0]).toEqual(['01', 'track.07 — artist.02', '', '3']);
  expect(cells[1]).toEqual(['02', 'track.12 — artist.01', '', '2']);
  expect(cells[9]).toEqual(['10', 'track.05 — artist.09', '', '1']);
  expect(cells[24]).toEqual(['25', 'track.25 — artist.03', '', '1']);
  // Bars: the fill's share of its track is the row's bar width (100% … 9%).
  const shares = await rows.evaluateAll((els) =>
    els.map((el) => {
      const track = el.children[2]!;
      return Math.round((track.firstElementChild!.getBoundingClientRect().width / track.getBoundingClientRect().width) * 100);
    }),
  );
  expect(shares).toEqual([
    100, 91, 80, 69, 61, 55, 48, 44, 38, 33, 30, 28, 25, 23, 22, 20, 19, 17, 16, 14, 14, 13, 11, 11, 9,
  ]);
  await expect(t.header).toContainText('01b · ~/now $ top tracks --week');
  await expect(t.header).toContainText('top tracks · 7 days · mock data');
  await expect(t.header.locator('[lang="ja"]')).toBeHidden();
  await expectExpanded(page);
});

test('np shows the last played track, expanded', async ({ page }) => {
  const t = terminal(page);
  await t.run('np');
  await expect.poll(() => t.lines()).toEqual([
    '■ [track title] — [artist]',
    '  2h ago',
  ]);
  await expect(t.header).toContainText('last.fm · mock data');
  await expectExpanded(page);
});

test('recent lists the mock tracks with times, the artist in the second colour, expanded', async ({ page }) => {
  const t = terminal(page);
  await t.run('recent');
  await expect.poll(() => t.lines()).toEqual([
    '2h   track.07 — artist.02',
    '2h   track.12 — artist.01',
    '2h   track.03 — artist.05',
    '3h   track.21 — artist.02',
    '3h   track.09 — artist.04',
    '4h   track.15 — artist.06',
    '4h   track.02 — artist.01',
    '5h   track.18 — artist.08',
    '6h   track.11 — artist.03',
    '6h   track.05 — artist.09',
    '7h   track.14 — artist.07',
    '7h   track.06 — artist.10',
    '8h   track.19 — artist.02',
    '9h   track.01 — artist.05',
    '10h  track.23 — artist.03',
    '11h  track.08 — artist.01',
    '13h  track.16 — artist.04',
    '15h  track.10 — artist.06',
    '17h  track.22 — artist.08',
    '20h  track.04 — artist.09',
    '22h  track.17 — artist.02',
    '1d   track.13 — artist.10',
    '1d   track.20 — artist.07',
    '2d   track.24 — artist.05',
    '3d   track.25 — artist.03',
  ]);
  const span = (text: string) => t.body.locator('span').filter({ hasText: text }).first();
  await expect(span('2h')).toHaveCSS('color', DIM);
  await expect(span('track.07')).toHaveCSS('color', 'rgb(189, 184, 173)');
  await expect(span('artist.02')).toHaveCSS('color', ACCENT);
  await expect(t.header).toContainText('last.fm · mock data');
  await expectExpanded(page);
});
