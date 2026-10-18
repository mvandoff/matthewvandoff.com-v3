import { expect, test, type Page } from '@playwright/test';
import { terminal } from '../helpers/terminal.ts';

const TEAL = 'rgb(143, 179, 173)'; // #8fb3ad, the default Accent
const RED = 'rgb(230, 164, 154)'; // #e6a49a, `accent red` tuned
const LILAC = 'rgb(201, 168, 216)'; // #c9a8d8

/**
 * Accent-tinted things a visitor sees: the role line (Accent) and the ASCII art,
 * fish or kaomoji (second colour).
 */
const role = (page: Page) => page.getByText('software developer', { exact: true });
const ascii = (page: Page) => page.locator('.aq');
const colour = (page: Page, which: 'role' | 'ascii') =>
  (which === 'role' ? role(page) : ascii(page)).evaluate((el) => getComputedStyle(el).color);

/**
 * Records the page's colours at the earliest moments it could paint: when <body>
 * is inserted, and in every animation frame until load (a frame callback runs
 * just before that frame is rendered). Read back with `firstPaint(page)`.
 */
async function watchFirstPaint(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const read = () => {
      const root = getComputedStyle(document.documentElement);
      const role = document.querySelector('.role');
      return {
        accent: root.getPropertyValue('--accent').trim(),
        second: root.getPropertyValue('--second').trim(),
        role: role ? getComputedStyle(role).color : null,
      };
    };
    const frames: unknown[] = [];
    w['__frames'] = frames;
    new MutationObserver((_, observer) => {
      if (document.body) {
        w['__atBody'] = read();
        observer.disconnect();
      }
    }).observe(document, { childList: true, subtree: true });
    let loaded = false;
    addEventListener('load', () => (loaded = true));
    const frame = () => {
      if (document.documentElement) frames.push(read());
      if (!loaded) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

/** The colours at <body> insertion and in each frame before load. */
const firstPaint = async (page: Page) => {
  await page.waitForLoadState('load');
  return page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    return {
      atBody: w['__atBody'] as Record<string, string | null>,
      frames: w['__frames'] as Array<Record<string, string | null>>,
    };
  });
};

/** Every recorded frame: the Accent and the role line are already `rgb` (once styled). */
function expectEveryFrame(frames: Array<Record<string, string | null>>, hex: string, rgb: string) {
  expect(frames.length).toBeGreaterThan(0);
  for (const frame of frames) {
    expect(frame['accent']).toBe(hex);
    expect(frame['second']).toBe(hex);
    if (frame['role'] !== null) expect(frame['role']).toBe(rgb);
  }
  expect(frames.some((frame) => frame['role'] === rgb)).toBe(true);
}

test.describe('accent', () => {
  test('accent red recolours the page, second colour included', async ({ page }) => {
    await page.goto('/');
    expect(await colour(page, 'role')).toBe(TEAL);
    expect(await colour(page, 'ascii')).toBe(TEAL);
    const t = terminal(page);
    await t.run('accent red');
    expect(await t.lines()).toEqual(['accent → red  tuned #e6a49a']);
    await expect.poll(() => colour(page, 'role')).toBe(RED);
    await expect.poll(() => colour(page, 'ascii')).toBe(RED);
    await t.run('accent');
    expect(await t.lines()).toEqual(['accent: any css color, a hue 0–360, random or reset', 'now #e6a49a']);
  });

  test('a reload keeps the Accent, with no flash of teal on first paint', async ({ page }) => {
    await page.goto('/');
    await terminal(page).run('accent red');
    await expect.poll(() => colour(page, 'role')).toBe(RED);
    await watchFirstPaint(page);
    await page.reload();
    const { atBody, frames } = await firstPaint(page);
    expect(atBody).toMatchObject({ accent: '#e6a49a' });
    expectEveryFrame(frames, '#e6a49a', RED);
    expect(await colour(page, 'role')).toBe(RED);
    await terminal(page).run('accent');
    expect(await terminal(page).lines()).toContain('now #e6a49a');
  });

  test('the stored Accent is applied by the head script alone, before any module script', async ({ page }) => {
    await page.goto('/');
    await terminal(page).run('accent lilac');
    await expect.poll(() => colour(page, 'role')).toBe(LILAC);
    await page.route('**/_astro/*.js', (route) => route.abort());
    await watchFirstPaint(page);
    await page.reload();
    const { atBody, frames } = await firstPaint(page);
    expect(atBody).toMatchObject({ accent: '#c9a8d8' });
    expectEveryFrame(frames, '#c9a8d8', LILAC);
    expect(await colour(page, 'ascii')).toBe(LILAC);
  });

  test('the 404 page wears the stored Accent from first paint too', async ({ page }) => {
    await page.goto('/');
    await terminal(page).run('accent red');
    await expect.poll(() => colour(page, 'role')).toBe(RED);
    await watchFirstPaint(page);
    await page.goto('/no/such/page');
    expect((await firstPaint(page)).atBody).toMatchObject({ accent: '#e6a49a' });
    const back = page.getByRole('link', { name: '[ back home ]' });
    expect(await back.evaluate((el) => getComputedStyle(el).color)).toBe(RED);
  });

  test('accent reset restores teal and clears storage', async ({ page }) => {
    await page.goto('/');
    const t = terminal(page);
    await t.run('accent red');
    await expect.poll(() => colour(page, 'role')).toBe(RED);
    await t.run('accent reset');
    expect(await t.lines()).toEqual(['accent → default']);
    await expect.poll(() => colour(page, 'role')).toBe(TEAL);
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    await page.reload();
    expect(await colour(page, 'role')).toBe(TEAL);
  });

  test('invalid input changes nothing', async ({ page }) => {
    await page.goto('/');
    const t = terminal(page);
    await t.run('accent lilac');
    await t.run('accent Dark Red');
    expect(await t.lines()).toEqual(['accent: not a color: Dark Red  · try red, #3af, 210 or random']);
    expect(await colour(page, 'role')).toBe(LILAC);
  });

  test('a junk stored value is ignored', async ({ page }) => {
    await page.goto('/');
    await terminal(page).run('accent red');
    await expect.poll(() => colour(page, 'role')).toBe(RED);
    await page.evaluate(() => {
      const key = localStorage.key(0)!;
      localStorage.setItem(key, 'red; background: url(x)');
    });
    await page.reload();
    expect(await colour(page, 'role')).toBe(TEAL);
  });

  test.describe('when localStorage throws', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          get() {
            throw new DOMException('The operation is insecure.', 'SecurityError');
          },
        });
      });
    });

    test('the page falls back to teal and the accent command still works for the visit', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (msg) => {
        // The 404 page's own status shows up as a resource error; anything else counts.
        if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) errors.push(msg.text());
      });
      await page.goto('/');
      expect(await colour(page, 'role')).toBe(TEAL);
      const t = terminal(page);
      await t.run('accent red');
      expect(await t.lines()).toEqual(['accent → red  tuned #e6a49a']);
      await expect.poll(() => colour(page, 'role')).toBe(RED);
      await t.run('accent');
      expect(await t.lines()).toContain('now #e6a49a');
      await page.reload();
      expect(await colour(page, 'role')).toBe(TEAL);
      await t.run('accent reset');
      expect(await t.lines()).toEqual(['accent → default']);
      await page.goto('/no/such/page');
      await expect(page.getByRole('link', { name: '[ back home ]' })).toBeVisible();
      expect(errors).toEqual([]);
    });
  });

  test('writes that fail (quota) still recolour for the visit, without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      };
    });
    await page.goto('/');
    await terminal(page).run('accent red');
    await expect.poll(() => colour(page, 'role')).toBe(RED);
    expect(errors).toEqual([]);
  });
});
