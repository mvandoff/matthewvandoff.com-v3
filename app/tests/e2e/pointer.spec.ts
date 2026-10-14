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
