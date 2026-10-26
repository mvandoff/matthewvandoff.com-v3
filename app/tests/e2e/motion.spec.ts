import { expect, test, type Page } from '@playwright/test';

/**
 * Entrance and ambient motion (Boot, name glitch, ASCII coin flip, blobs, field).
 * Timers run on Playwright's fake clock; CSS animations run on real time, so these
 * tests look at which animations are attached, not at frames.
 */

const boot = (page: Page) => page.locator('.boot');

/** A paused fake clock: page timers only run when the test calls runFor. */
async function pauseClock(page: Page) {
  const start = new Date(2026, 9, 14, 9, 30, 0);
  await page.clock.install({ time: start });
  await page.clock.pauseAt(start.getTime() + 10_000);
}

/** Names of the CSS animations currently attached to the elements matching `selector`. */
const animationsOn = (page: Page, selector: string) =>
  page.evaluate(
    (sel) =>
      [...document.querySelectorAll(sel)].flatMap((el) =>
        el.getAnimations({ subtree: true }).map((a) => (a as CSSAnimation).animationName ?? 'transition'),
      ),
    selector,
  );

test.describe('entrance', () => {
  test('the Boot overlay covers the page on load and is gone by ~1.5s', async ({ page }) => {
    await pauseClock(page);
    await page.goto('/');
    await expect(boot(page)).toHaveCSS('display', 'block');
    await expect(boot(page)).toContainText('~/home $ boot');
    await page.clock.runFor(1500);
    await expect(boot(page)).toBeHidden();
  });

  test('the name glitches in with both Accent ghosts, then settles', async ({ page }) => {
    await pauseClock(page);
    await page.goto('/');
    const name = await animationsOn(page, '.nmh');
    expect(name.filter((n) => n === 'glin')).toHaveLength(2); // two lines of the real name
    expect(name.filter((n) => n === 'glA')).toHaveLength(2);
    expect(name.filter((n) => n === 'glB')).toHaveLength(2);
    await page.clock.runFor(3600);
    await expect.poll(() => animationsOn(page, '.nmh')).toEqual([]);
    await expect(page.locator('.nmh .nm')).toBeVisible();
  });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('there is no Boot and the name is static', async ({ page }) => {
    await pauseClock(page);
    await page.goto('/');
    await expect(boot(page)).toBeHidden();
    expect(await animationsOn(page, '.nmh')).toEqual([]);
    await expect(page.locator('.nmh .nm')).toBeVisible();
    await expect(page.locator('.nmh .nm .ln-i').first()).toHaveCSS('opacity', '1');
  });

  test('blobs, field, fish and kaomoji hold still', async ({ page }) => {
    await page.goto('/');
    expect(await animationsOn(page, '.lead-bg, .aq, .fld')).toEqual([]);
    await expect(page.locator('.fld .blob.a')).toHaveCSS('transform', 'none');
  });
});

test.describe('ASCII coin flip', () => {
  for (const [random, shown, gone] of [
    [0.1, 'fish', 'kaomoji'],
    [0.9, 'kaomoji', 'fish'],
  ] as const) {
    test(`shows only the ${shown} when the coin lands that way`, async ({ page }) => {
      await page.addInitScript((r) => {
        Math.random = () => r;
      }, random);
      await page.goto('/');
      await expect(page.getByRole('img', { name: new RegExp(shown) })).toBeVisible();
      await expect(page.getByRole('img', { name: new RegExp(gone) })).toBeHidden();
    });
  }

  test('shows exactly one of fish or kaomoji', async ({ page }) => {
    await page.goto('/');
    const art = page.locator('.aq').getByRole('img');
    await expect(art).toHaveCount(1);
    await expect(art).toBeVisible();
  });

  test('the fish swims and blows bubbles; the kaomoji puts its shades on', async ({ page }) => {
    await page.addInitScript(() => {
      Math.random = () => 0.1;
    });
    await page.goto('/');
    expect((await animationsOn(page, '.aq')).sort()).toEqual(['bub', 'swim']);

    await page.addInitScript(() => {
      Math.random = () => 0.9;
    });
    await page.reload();
    expect((await animationsOn(page, '.aq')).sort()).toEqual(['fr1', 'fr2', 'fr3']);
  });
});

test.describe('ambient', () => {
  test('the Name card blobs drift', async ({ page }) => {
    await page.goto('/');
    expect((await animationsOn(page, '.lead-bg')).sort()).toEqual(['lbA', 'lbB', 'lbC']);
  });

  test('the background field moves with scroll and with the cursor', async ({ page }) => {
    await page.goto('/');
    const blob = page.locator('.fld .blob.a');
    const at = () => blob.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
    // Transitions are skipped here so each read is the resting position.
    await page.addStyleTag({ content: '.blob { transition: none !important; }' });

    const start = await at();
    await page.mouse.move(1000, 600);
    await expect.poll(at).toBeGreaterThan(start);

    const afterMouse = await at();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(at).toBeGreaterThan(afterMouse + 100);
  });

  test('the name ghosts split apart under the cursor', async ({ page }) => {
    await page.goto('/');
    await page.addStyleTag({ content: '.gh { transition: none !important; }' });
    const offset = () =>
      page.evaluate(() => {
        const x = (sel: string) => new DOMMatrix(getComputedStyle(document.querySelector(sel)!).transform).m41;
        return x('.nmh .gh.gb') - x('.nmh .gh.ga');
      });
    const apart = await offset();
    await page.locator('.nmh').hover();
    await expect.poll(offset).toBeGreaterThan(apart + 10);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('there is no Boot and the name and fish are visible', async ({ page }) => {
    await page.goto('/');
    await expect(boot(page)).toBeHidden();
    await expect(page.locator('.nmh .nm')).toBeVisible();
    await expect(page.getByRole('img', { name: /fish/ })).toBeVisible();
  });
});
