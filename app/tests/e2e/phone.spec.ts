import { expect, test, type Locator, type Page } from '@playwright/test';
import { terminal } from '../helpers/terminal.ts';

/**
 * Phone and narrow layouts: the design's 760px phone breakpoint and its 900px
 * Episode reflow, the behaviour a phone visitor relies on.
 */

const PHONE = { width: 390, height: 844 };

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error(`no box for ${locator}`);
  return b;
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.describe('at 390px', () => {
  test.use({ viewport: PHONE });

  test('the Strip stacks: Name card, the Cels as full-width rows, then the Terminal', async ({ page }) => {
    await page.goto('/');
    expect(await horizontalOverflow(page)).toBe(0);

    const name = await box(page.locator('.cel.lead'));
    const cels = page.getByRole('link', { name: /^0[234] / });
    await expect(cels).toHaveCount(3);
    const term = await box(terminal(page).box);

    let previousBottom = name.y + name.height;
    for (const cel of await cels.all()) {
      const b = await box(cel);
      expect(b.y).toBeGreaterThanOrEqual(previousBottom);
      expect(b.width).toBeCloseTo(name.width, 0);
      expect(b.height).toBe(62); // 60px row plus its 1px borders, as on the board
      // The label reads horizontally, followed by a → at the far end.
      const label = await box(cel.locator('.vlabel'));
      expect(label.width).toBeGreaterThan(label.height);
      expect(await cel.evaluate((el) => getComputedStyle(el, '::after').content)).toBe('"→"');
      previousBottom = b.y + b.height;
    }
    expect(term.y).toBeGreaterThan(previousBottom);
    expect(term.width).toBeCloseTo(name.width, 0);
  });

  test('the katakana, header prompt, Terminal hint and long clock are hidden; the clock is short', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('.kana')).toBeHidden();
    await expect(page.locator('header .prompt')).toBeHidden();
    await expect(terminal(page).hint).toBeHidden();
    await expect(page.locator('[data-clock="long"]')).toBeHidden();
    await expect(page.locator('[data-clock="short"]')).toHaveText(/^\d\d:\d\d:\d\d$/);
    await expect(page.locator('#experience').getByText('episode guide')).toBeHidden();
  });

  test('the name scales with the viewport and the page never scrolls sideways', async ({ page }) => {
    await page.goto('/');
    // clamp(48px, 14vw, 100px) at 390px = 54.6px.
    await expect(page.locator('.nmh')).toHaveCSS('font-size', '54.6px');
    for (const width of [320, 360, 600, 760]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await horizontalOverflow(page), `${width}px`).toBe(0);
    }
  });

  test('the Terminal input is 16px, and large output stays in place below the Cels', async ({ page }) => {
    await page.goto('/');
    const t = terminal(page);
    await expect(t.input).toHaveCSS('font-size', '16px');

    const before = await box(t.box);
    for (const command of ['help', 'top', 'recent']) {
      await t.run(command);
      await expect(t.header).toContainText(`~/now $ ${command}`);
      // No upward expansion: the Terminal keeps its place and the Name card stays.
      await page.waitForTimeout(600); // longer than the desktop's .5s expansion
      expect(await box(t.box)).toEqual(before);
      await expect(page.locator('.cel.lead')).toHaveCSS('opacity', '1');
      // The output scrolls inside the Terminal rather than widening the page.
      expect(await horizontalOverflow(page)).toBe(0);
      expect(await t.body.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);
    }
  });

  test('about and Episode descriptions are set in Geist 15px, which is fetched but not preloaded', async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);

    for (const copy of [page.locator('.ab-p').first(), page.locator('#experience article p').last()]) {
      await expect(copy).toHaveCSS('font-family', /^Geist,/);
      await expect(copy).toHaveCSS('font-size', '15px');
      await expect(copy).toHaveCSS('line-height', '24px');
    }
    expect(await page.evaluate(() => document.fonts.check('15px Geist'))).toBe(true);
    expect(requests.filter((url) => /geist/i.test(url))).toHaveLength(1);
    await expect(page.locator('link[rel="preload"][href*="Geist" i]')).toHaveCount(0);
  });

  test('the footer stacks, centred', async ({ page }) => {
    await page.goto('/');
    const items = page.locator('footer .foot > *');
    const boxes = await Promise.all((await items.all()).map(box));
    for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.y).toBeGreaterThan(boxes[i - 1]!.y);
    for (const b of boxes) expect(Math.abs(b.x + b.width / 2 - PHONE.width / 2)).toBeLessThan(1);
  });
});

test.describe('breakpoints', () => {
  test('the phone layout starts at 760px and the desktop Strip at 761px', async ({ page }) => {
    await page.setViewportSize({ width: 761, height: 900 });
    await page.goto('/');
    const kana = page.locator('.kana');
    const about = page.getByRole('link', { name: /^02 / });
    await expect(kana).toBeVisible();
    expect(await box(about).then((b) => b.height)).toBeGreaterThan(200); // a tall Strip Cel

    await page.setViewportSize({ width: 760, height: 900 });
    await expect(kana).toBeHidden();
    expect(await box(about).then((b) => b.height)).toBe(62);
  });

  test('Episodes reflow at 900px: number and years on a row, the title and description below', async ({ page }) => {
    const episode = page.locator('#experience article').first();
    const parts = {
      number: episode.locator(':scope > :nth-child(1)'),
      years: episode.locator(':scope > :nth-child(2)'),
      title: episode.getByRole('heading'),
      description: episode.locator(':scope > p'),
    };

    await page.setViewportSize({ width: 901, height: 900 });
    await page.goto('/');
    // Four columns side by side.
    const wide = await Promise.all(Object.values(parts).map(box));
    for (let i = 1; i < wide.length; i++) expect(wide[i]!.x).toBeGreaterThan(wide[i - 1]!.x);

    await page.setViewportSize({ width: 900, height: 900 });
    const [number, years, title, description] = await Promise.all(Object.values(parts).map(box));
    expect(years!.y).toBeLessThan(number!.y + number!.height); // same row…
    expect(years!.x + years!.width).toBeCloseTo((await box(episode)).x + (await box(episode)).width, 0); // …at the end
    expect(title!.x).toBeCloseTo(number!.x, 0);
    expect(title!.y).toBeGreaterThan(number!.y + number!.height);
    expect(description!.y).toBeGreaterThan(title!.y + title!.height);
  });
});
