import { devices, expect, test, type Page } from '@playwright/test';

/**
 * Pointer-driven effects: the Crosshair and its HUD, the Cel and Episode hovers, and
 * the github/linkedin scramble. Exact looks are compared with the board in
 * tests/design/pointer.spec.ts; these tests pin the behaviour.
 */

const crosshair = (page: Page) => page.locator('.xh');
const hud = (page: Page) => ({
  x: page.locator('.hud-v.vx'),
  y: page.locator('.hud-v.vy'),
});

/** The centre square's inset (its ::before grows outward over clickable things). */
const squareInset = (page: Page) =>
  page.locator('.xh-s').evaluate((el) => getComputedStyle(el, '::before').top);

test.describe('Crosshair', () => {
  test('stays hidden until the mouse moves, then shows', async ({ page }) => {
    await page.goto('/');
    await expect(crosshair(page)).toHaveCSS('opacity', '0');
    await page.mouse.move(400, 300);
    await expect(crosshair(page)).toHaveCSS('opacity', '1');
  });

  test('the HUD shows the zero-padded cursor position as it moves', async ({ page }) => {
    await page.goto('/');
    await page.mouse.move(37, 412);
    await expect(hud(page).x).toHaveText('0037');
    await expect(hud(page).y).toHaveText('0412');
    await page.mouse.move(1203, 8);
    await expect(hud(page).x).toHaveText('1203');
    await expect(hud(page).y).toHaveText('0008');
  });

  test('the lines cross at the cursor', async ({ page }) => {
    await page.goto('/');
    await page.mouse.move(640, 220);
    await expect(page.locator('.xh-v')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 640, 0)');
    await expect(page.locator('.xh-h')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 220)');
  });

  test('the centre square grows over clickable things and shrinks back off them', async ({ page }) => {
    await page.goto('/');
    await page.mouse.move(700, 870); // empty space below the Strip
    await expect.poll(() => squareInset(page)).toBe('0px');
    await page.getByRole('link', { name: /^03 experience/ }).hover();
    await expect.poll(() => squareInset(page)).toBe('-6px');
    await page.locator('.cel.sig').hover(); // the Terminal is a click target too
    await expect.poll(() => squareInset(page)).toBe('-6px');
    await page.mouse.move(700, 870);
    await expect.poll(() => squareInset(page)).toBe('0px');
  });

  test('fades out when the mouse leaves the window', async ({ page }) => {
    await page.goto('/');
    await page.mouse.move(400, 300);
    await expect(crosshair(page)).toHaveCSS('opacity', '1');
    await page.locator('html').dispatchEvent('mouseout', { relatedTarget: null });
    await expect(crosshair(page)).toHaveCSS('opacity', '0');
  });

  test('the HUD lifts above the footer once it scrolls into view', async ({ page }) => {
    await page.goto('/');
    await page.mouse.move(400, 300);
    const hudBottom = async () => (await page.locator('.hud').boundingBox())!.y + (await page.locator('.hud').boundingBox())!.height;
    expect(await hudBottom()).toBeCloseTo(900 - 20, 0);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const footTop = async () => (await page.locator('#foot').boundingBox())!.y;
    await expect.poll(async () => (await hudBottom()) - (await footTop())).toBeLessThanOrEqual(-19);
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('is absent', async ({ page }) => {
      await page.goto('/');
      await page.mouse.move(400, 300);
      await expect(crosshair(page)).toBeHidden();
    });
  });

  test.describe('on a touch device', () => {
    const { defaultBrowserType: _, ...pixel } = devices['Pixel 7'];
    test.use(pixel);
    test('is absent', async ({ page }) => {
      await page.goto('/');
      await page.locator('.cel.sig').tap();
      await expect(crosshair(page)).toBeHidden();
    });
  });
});

const ACCENT = 'rgb(143, 179, 173)';

test.describe('Cel', () => {
  const cel = (page: Page) => page.getByRole('link', { name: /^02 about/ });
  const wash = (page: Page) => cel(page).locator('.hov');

  async function expectLit(page: Page) {
    await expect(cel(page)).toHaveCSS('border-color', ACCENT);
    await expect(cel(page).locator('.vlabel')).toHaveCSS('color', ACCENT);
    await expect(wash(page)).toHaveCSS('clip-path', 'inset(0px)');
  }

  test('at rest: no wash, rule border, ink label', async ({ page }) => {
    await page.goto('/');
    await expect(cel(page)).toHaveCSS('border-color', 'rgb(46, 47, 56)');
    await expect(cel(page).locator('.vlabel')).toHaveCSS('color', 'rgb(228, 221, 207)');
    await expect(wash(page)).toHaveCSS('clip-path', 'inset(0px 0px 100%)');
  });

  test('hover shows the dotted Accent wash, an Accent border and an Accent label', async ({ page }) => {
    await page.goto('/');
    await cel(page).hover();
    await expectLit(page);
  });

  test('keyboard focus gets the same treatment as hover', async ({ page }) => {
    await page.goto('/');
    await page.locator('#term-in').focus();
    await page.keyboard.press('Tab'); // Terminal input -> first Cel
    await expect(cel(page)).toBeFocused();
    await expectLit(page);
  });
});

test.describe('Episode', () => {
  test('hovering a row tints it and turns its title Accent', async ({ page }) => {
    await page.goto('/');
    const ep = page.locator('.ep').first();
    await ep.scrollIntoViewIfNeeded();
    await expect(ep).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await ep.hover();
    await expect(ep).toHaveCSS('background-color', 'color(srgb 0.12549 0.129412 0.156863 / 0.55)');
    await expect(ep.locator('.ep-t')).toHaveCSS('color', ACCENT);
  });
});

test.describe('github/linkedin scramble', () => {
  /** A paused fake clock: the scramble's 34ms ticks only run when the test calls runFor. */
  async function pauseClock(page: Page) {
    const start = new Date(2026, 9, 14, 9, 30, 0);
    await page.clock.install({ time: start });
    await page.clock.pauseAt(start.getTime() + 10_000);
  }

  const link = (page: Page, name: string) => page.getByRole('link', { name, exact: true });
  const live = (page: Page, name: string) => link(page, name).locator('.dw-live');
  const noise = (page: Page, name: string) => link(page, name).locator('.nz');

  /** Every box in the links Section, to prove the scramble never moves anything. */
  const layout = (page: Page) =>
    page
      .locator('#links, #links .big, #links .dw, #links .dw-ghost, #links .big > [aria-hidden]:last-child, #foot')
      .evaluateAll((els) => els.map((el) => JSON.stringify(el.getBoundingClientRect())));

  for (const [name, trigger] of [
    ['github', 'hover'],
    ['linkedin', 'focus'],
  ] as const) {
    test(`${trigger} scrambles ${name} through glyphs, then resolves to the exact word without moving anything`, async ({
      page,
    }) => {
      await pauseClock(page);
      await page.goto('/');
      await page.clock.runFor(4000); // past the entrance
      await link(page, name).scrollIntoViewIfNeeded();
      const before = await layout(page);
      await expect(live(page, name)).toHaveText(name);

      await (trigger === 'hover' ? link(page, name).hover() : link(page, name).focus());
      const frames: string[] = [];
      for (let i = 0; i < name.length + 8; i++) {
        frames.push((await noise(page, name).textContent()) ?? '');
        expect(await layout(page)).toEqual(before);
        expect(await live(page, name).textContent()).toHaveLength(name.length);
        await page.clock.runFor(34);
      }
      // All noise at first, then one more real letter per tick.
      expect(frames[0]).toHaveLength(name.length);
      expect(frames[0]).toMatch(/^[!<>\-_\\/[\]{}=+*^?#01]+$/);
      expect(frames.slice(6, 6 + name.length).map((f) => f.length)).toEqual(
        [...name].map((_, i) => name.length - i),
      );
      await expect(live(page, name)).toHaveText(name);
      await expect(noise(page, name)).toBeEmpty();
      expect(await layout(page)).toEqual(before);
    });
  }

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('the words never scramble', async ({ page }) => {
      await pauseClock(page);
      await page.goto('/');
      await link(page, 'github').hover();
      await page.clock.runFor(100);
      await expect(live(page, 'github')).toHaveText('github');
      await expect(noise(page, 'github')).toBeEmpty();
    });
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the Crosshair never shows and the link words are plain', async ({ page }) => {
    await page.goto('/');
    await page.mouse.move(400, 300);
    await expect(crosshair(page)).toHaveCSS('opacity', '0');
    await expect(page.locator('#links .dw-live')).toHaveText(['github', 'linkedin']);
  });
});
