import { expect, test, type Page } from '@playwright/test';

/**
 * Navigation and scroll (spec stories 16-21, 33, 50): smooth scroll plus Lock-on
 * for the Cels, [ mvd ], back-to-top and `cd`; the header prompt, progress line
 * and border tracking the scroll; reveal-on-scroll; hash landing; reduced motion.
 */

const SECTIONS = ['about', 'experience', 'links'] as const;

/** Lock-on timings (src/scripts/motion/scroll.ts): the bracket mounts at 650ms and unmounts at 2250ms. */
const LOCK_SHOW_MS = 650;
const LOCK_HIDE_MS = 2250;

/**
 * Opens the page on a paused fake clock, past the entrance. The Lock-on bracket's
 * 1.6s window then only moves when the test runs the clock, however loaded the
 * machine is. (The smooth scroll itself is the browser's and still runs in real time.)
 */
async function openOnPausedClock(page: Page) {
  const start = new Date(2026, 9, 14, 9, 30, 0);
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1000));
  await page.goto('/');
  await page.clock.runFor(4000);
}

/**
 * Where a page scrolled to `#id` should end up: the Section's layout box at the top
 * of the viewport (ignoring the reveal's 32px offset), or as far as the page scrolls.
 */
const landingFor = (page: Page, id: string) =>
  page.locator(`#${id}`).evaluate((el) => {
    const top = el.getBoundingClientRect().top + scrollY - new DOMMatrix(getComputedStyle(el).transform).f;
    return Math.min(Math.round(top), document.documentElement.scrollHeight - innerHeight);
  });

const scrollTop = (page: Page) => page.evaluate(() => Math.round(scrollY));

const cel = (page: Page, label: string) => page.getByRole('link', { name: new RegExp(`^\\d\\d ${label}\\b`) });

/** The Lock-on tag on a Section heading ("found ~/about"). */
const lockTag = (page: Page, id: string) => page.locator(`#${id} .locktag`);

test.describe('Cels', () => {
  for (const id of SECTIONS) {
    test(`clicking the ${id} Cel scrolls to it and locks on`, async ({ page }) => {
      await openOnPausedClock(page);
      await cel(page, id).click();
      await expect.poll(() => scrollTop(page)).toBe(await landingFor(page, id));
      await expect(lockTag(page, id)).toBeHidden(); // not before 650ms
      await page.clock.runFor(LOCK_SHOW_MS);
      await expect(lockTag(page, id)).toHaveText(`found ~/${id}`);
      // Bracket and tag show together.
      // (Checked on the `hidden` attribute the helper toggles: the bracket's own CSS
      // animation runs in real time and may be at a zero-size frame on a loaded machine.)
      await expect(page.locator(`#${id} [data-lock="${id}"]:not([hidden])`)).toHaveCount(2);
      // The bracket is brief: gone again after its 1.6s run.
      await page.clock.runFor(LOCK_HIDE_MS - LOCK_SHOW_MS);
      await expect(lockTag(page, id)).toBeHidden();
      await expect(page).toHaveURL(/\/$/);
    });
  }
});

test('a Section not yet revealed is still landed on exactly', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 500 });
  await page.goto('/');
  const landing = await landingFor(page, 'experience');
  await cel(page, 'experience').click();
  await expect.poll(() => scrollTop(page)).toBe(landing);
  await page.waitForTimeout(500);
  expect(await scrollTop(page)).toBe(landing);
});

test.describe('home', () => {
  for (const [name, link] of [
    ['[ mvd ]', (page: Page) => page.getByRole('banner').getByRole('link', { name: '[ mvd ]' })],
    ['back to top', (page: Page) => page.getByRole('link', { name: '[ back to top ↑ ]' })],
  ] as const) {
    test(`${name} scrolls back to the top and locks on the whoami line`, async ({ page }) => {
      await openOnPausedClock(page);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await link(page).click();
      await expect.poll(() => scrollTop(page)).toBe(0);
      const lock = page.locator('.nc-prompt .lock[data-lock="top"]');
      await expect(lock).toBeHidden();
      await page.clock.runFor(LOCK_SHOW_MS);
      await expect(page.locator('.nc-prompt .lock:not([hidden])')).toHaveCount(1);
      await page.clock.runFor(LOCK_HIDE_MS - LOCK_SHOW_MS);
      await expect(lock).toBeHidden();
      await expect(page).toHaveURL(/\/$/);
    });
  }
});

test.describe('cd', () => {
  for (const id of SECTIONS) {
    test(`cd ${id} locks on its heading`, async ({ page }) => {
      await openOnPausedClock(page);
      const input = page.getByRole('textbox', { name: 'terminal command, type help' });
      await input.fill(`cd ${id}`);
      await input.press('Enter');
      await expect.poll(() => scrollTop(page)).toBe(await landingFor(page, id));
      await page.clock.runFor(LOCK_SHOW_MS);
      await expect(page.locator(`#${id} .locktag:not([hidden])`)).toHaveCount(1);
    });
  }

  test('only the latest target locks on', async ({ page }) => {
    await openOnPausedClock(page);
    const input = page.getByRole('textbox', { name: 'terminal command, type help' });
    await input.fill('cd about');
    await input.press('Enter');
    await input.fill('cd links');
    await input.press('Enter');
    await page.clock.runFor(LOCK_SHOW_MS);
    await expect(page.locator('#links .locktag:not([hidden])')).toHaveCount(1);
    await expect(page.locator('.locktag:not([hidden])')).toHaveCount(1);
  });
});

test.describe('header', () => {
  const prompt = (page: Page) => page.getByRole('banner').locator('.prompt');
  const progress = (page: Page) =>
    page.locator('.prog').evaluate((el) => el.getBoundingClientRect().width / document.documentElement.clientWidth);
  const scrollTo = (page: Page, y: number) => page.evaluate((top) => window.scrollTo(0, top), y);

  test('the prompt follows the Section being read', async ({ page }) => {
    await page.goto('/');
    await expect(prompt(page)).toHaveText('~/home $');
    for (const id of SECTIONS) {
      // A Section becomes current once its top passes 200px from the top of the viewport.
      const top = await page.locator(`#${id}`).evaluate((el) => el.getBoundingClientRect().top + scrollY);
      await scrollTo(page, top - 190);
      await expect(prompt(page)).toHaveText(`~/${id} $`);
    }
    await scrollTo(page, 0);
    await expect(prompt(page)).toHaveText('~/home $');
  });

  test('links is current at the very bottom of the page', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1440, height: 1400 });
    await scrollTo(page, 99_999);
    await expect(prompt(page)).toHaveText('~/links $');
  });

  test('the progress line scales with the scroll', async ({ page }) => {
    await page.goto('/');
    expect(await progress(page)).toBe(0);
    const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    await scrollTo(page, max / 2);
    await expect.poll(() => progress(page)).toBeCloseTo(0.5, 2);
    await scrollTo(page, max);
    await expect.poll(() => progress(page)).toBeCloseTo(1, 3);
  });

  test('the border shows once the page has scrolled', async ({ page }) => {
    await page.goto('/');
    const bar = page.getByRole('banner');
    await expect(bar).not.toHaveClass(/\bdown\b/);
    await scrollTo(page, 8);
    await page.waitForTimeout(100);
    await expect(bar).not.toHaveClass(/\bdown\b/);
    await scrollTo(page, 9);
    await expect(bar).toHaveClass(/\bdown\b/);
    await expect(bar).toHaveCSS('border-bottom-color', 'rgb(46, 47, 56)');
    await scrollTo(page, 0);
    await expect(bar).not.toHaveClass(/\bdown\b/);
  });
});

/** A Section's opacity, its vertical offset and how far its heading rule has drawn (0-1). */
const revealState = (page: Page, id: string) =>
  page.locator(`#${id}`).evaluate((el) => {
    const style = getComputedStyle(el);
    const rule = getComputedStyle(el.querySelector('.sh-r')!, '::after').transform;
    const scale = rule === 'none' ? 1 : new DOMMatrix(rule).a;
    return { opacity: Number(style.opacity), y: new DOMMatrix(style.transform).f, rule: scale };
  });

test.describe('reveal on scroll', () => {
  test('Sections below the fold wait, then rise in with the rule drawing across', async ({ page }) => {
    await page.goto('/');
    await expect.poll(() => revealState(page, 'links')).toEqual({ opacity: 0, y: 32, rule: 0 });
    await page.locator('#links').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 500));
    await expect.poll(() => revealState(page, 'links')).toEqual({ opacity: 1, y: 0, rule: 1 });
    // Once seen, a Section stays revealed.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);
    expect(await revealState(page, 'links')).toEqual({ opacity: 1, y: 0, rule: 1 });
  });

  test('a Section in view on load is revealed', async ({ page }) => {
    // At 1440x900 the about Section's top (777px) is just inside the 88% line (792px),
    // and would fall outside it if measured with the reveal's 32px offset.
    await page.goto('/');
    await expect.poll(() => revealState(page, 'about')).toEqual({ opacity: 1, y: 0, rule: 1 });
  });
});

test.describe('hash URLs', () => {
  for (const id of SECTIONS) {
    test(`/#${id} lands on the Section`, async ({ page }) => {
      await page.goto(`/#${id}`);
      await page.evaluate(() => document.fonts.ready);
      await expect.poll(() => scrollTop(page)).toBe(await landingFor(page, id));
      await expect(page.getByRole('banner').locator('.prompt')).toHaveText(`~/${id} $`);
      await expect.poll(() => revealState(page, id)).toEqual({ opacity: 1, y: 0, rule: 1 });
      // ...and stays there once everything has settled.
      await page.waitForTimeout(1500);
      expect(await scrollTop(page)).toBe(await landingFor(page, id));
    });
  }

  test('/#links still lands once late fonts have changed the page height', async ({ page }) => {
    await page.route('**/fonts/**', async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.continue();
    });
    await page.goto('/#links');
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => scrollTop(page)).toBe(await landingFor(page, 'links'));
  });

  test('changing the hash on the page lands on the Section too', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => (location.hash = '#experience'));
    await expect.poll(() => scrollTop(page)).toBe(await landingFor(page, 'experience'));
    await page.waitForTimeout(1200);
    expect(await scrollTop(page)).toBe(await landingFor(page, 'experience'));
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('/#links lands on the Section', async ({ page }) => {
      await page.goto('/#links');
      // The browser's own jump can come before the fonts settle the page height, so
      // without JS it may end a few px short of the very bottom.
      await expect.poll(async () => Math.abs((await scrollTop(page)) - (await landingFor(page, 'links')))).toBeLessThan(8);
    });
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('Cels, [ mvd ] and cd jump instantly with no Lock-on', async ({ page }) => {
    await page.goto('/');
    const locks = page.locator('.lock:visible, .locktag:visible');
    await cel(page, 'experience').click();
    expect(await scrollTop(page)).toBe(await landingFor(page, 'experience'));
    const input = page.getByRole('textbox', { name: 'terminal command, type help' });
    await page.getByRole('banner').getByRole('link', { name: '[ mvd ]' }).click();
    expect(await scrollTop(page)).toBe(0);
    await input.fill('cd links');
    await input.press('Enter');
    await expect.poll(() => scrollTop(page)).toBe(await landingFor(page, 'links'));
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(400);
      await expect(locks).toHaveCount(0);
    }
  });

  test('Sections are visible immediately, rules drawn, with nothing animating', async ({ page }) => {
    await page.goto('/');
    for (const id of SECTIONS) {
      expect(await revealState(page, id)).toEqual({ opacity: 1, y: 0, rule: 1 });
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(100);
    const running = await page.evaluate(
      () => [...document.querySelectorAll('main section')].flatMap((s) => s.getAnimations({ subtree: true })).length,
    );
    expect(running).toBe(0);
  });
});
