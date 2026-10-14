import { expect, test, type Browser, type Page } from '@playwright/test';
import { BOARD_URL, serveBoard } from './board.ts';

/**
 * Motion against the live board: the same elements must carry the same animations
 * (name, duration, delay, easing, iterations, direction, fill, keyframes), the same
 * transitions, and land on the same transforms for the pointer- and scroll-driven
 * effects. The board is the truth; nothing here is a hand-copied constant.
 */

test.use({ viewport: { width: 1440, height: 900 } });

type Side = 'site' | 'board';
const START = new Date(2026, 9, 14, 9, 30, 0);

async function open(browser: Browser, side: Side, opts: { random?: number; reduced?: boolean } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: opts.reduced ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  // A paused fake clock keeps the Boot and intro state in place while we read them,
  // however slowly the page loads; tests advance it with runFor.
  await page.clock.install({ time: START });
  await page.clock.pauseAt(START.getTime() + 10_000);
  await page.addInitScript((r) => {
    Math.random = () => r;
  }, opts.random ?? 0.1);
  if (side === 'board') {
    await serveBoard(page);
    await page.goto(BOARD_URL);
    await page.locator('.nmh').waitFor(); // the canvas runtime mounts after load
  } else {
    await page.goto('/');
  }
  return page;
}

/**
 * Every animation on (and inside) the matching elements, in a comparable form.
 * Keyframe transforms are resolved to matrices on a fixed 100x100 probe box, since
 * the site's built CSS is minified (`translateX(5px)` ships as `translate(5px)`).
 */
const animationsOf = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const probe = document.body.appendChild(document.createElement('div'));
    probe.style.cssText = 'position:absolute;left:-9999px;width:100px;height:100px;font-size:15px';
    const matrix = (transform: unknown) => {
      probe.style.transform = String(transform);
      return getComputedStyle(probe).transform;
    };
    const els = [...document.querySelectorAll(sel)];
    const result = els.flatMap((el) =>
      el.getAnimations({ subtree: true }).map((a) => {
        const effect = a.effect as KeyframeEffect;
        const t = effect.getTiming();
        return {
          name: (a as CSSAnimation).animationName,
          pseudo: effect.pseudoElement,
          duration: t.duration,
          delay: t.delay,
          easing: t.easing,
          iterations: t.iterations,
          direction: t.direction,
          fill: t.fill,
          keyframes: effect
            .getKeyframes()
            .map(({ computedOffset: _, ...k }) => ('transform' in k ? { ...k, transform: matrix(k['transform']) } : k)),
        };
      }),
    );
    probe.remove();
    return result;
  }, selector);

const MOTION = {
  'Boot overlay': '.boot',
  'name (real text)': '.nmh .nm',
  'name ghost a': '.nmh .gh.ga',
  'name ghost b': '.nmh .gh.gb',
  'Name card blobs': '.lead-bg',
  'ASCII art': '.aq',
};

for (const [coin, random] of [
  ['fish', 0.1],
  ['shades', 0.9],
] as const) {
  test(`entrance and ambient animations match the board (${coin})`, async ({ browser }) => {
    const site = await open(browser, 'site', { random });
    const board = await open(browser, 'board', { random });
    await expect(board.locator('.boot')).toBeAttached();
    for (const [label, selector] of Object.entries(MOTION)) {
      const expected = await animationsOf(board, selector);
      expect.soft(await animationsOf(site, selector), label).toEqual(expected);
    }
    // Sanity: the comparison saw real animations, not two empty lists.
    expect((await animationsOf(board, '.boot')).length).toBe(5);
    expect((await animationsOf(board, '.nmh')).length).toBe(6);
  });
}

test('with reduced motion nothing in the entrance or ambience animates', async ({ browser }) => {
  for (const random of [0.1, 0.9]) {
    const site = await open(browser, 'site', { random, reduced: true });
    const board = await open(browser, 'board', { random, reduced: true });
    for (const [label, selector] of Object.entries(MOTION)) {
      const actual = await animationsOf(site, selector);
      expect.soft(actual, label).toEqual([]);
      // The board's reduced-motion rule `.lb{animation:none}` loses to the more
      // specific `.lb.a{animation:lbA ...}`, so its blobs keep drifting. The rule's
      // intent (and the spec) is blobs off; the site follows the intent.
      if (selector !== '.lead-bg') expect.soft(actual, label).toEqual(await animationsOf(board, selector));
    }
  }
});

/** Transforms of the ghosts and field blobs once every running transition has landed. */
const settled = (page: Page) =>
  page.evaluate(() => {
    for (const a of document.getAnimations()) if (!(a as CSSAnimation).animationName) a.finish();
    const of = (sel: string) => getComputedStyle(document.querySelector(sel)!).transform;
    // A transition with property none is no transition, whatever its duration says.
    const transition = (sel: string) => {
      const style = getComputedStyle(document.querySelector(sel)!);
      return style.transitionProperty === 'none' ? 'none' : style.transition;
    };
    return {
      ga: of('.nmh .gh.ga'),
      gb: of('.nmh .gh.gb'),
      fieldA: of('.fld .blob.a'),
      fieldB: of('.fld .blob.b'),
      ghostTransition: transition('.nmh .gh.ga'),
      fieldTransition: transition('.fld .blob.a'),
    };
  });

test('the name split hover and the background field land where the board does', async ({ browser }) => {
  for (const reduced of [false, true]) {
    const pages = { site: await open(browser, 'site', { reduced }), board: await open(browser, 'board', { reduced }) };
    const states: Record<Side, unknown[]> = { site: [], board: [] };
    for (const side of ['site', 'board'] as const) {
      const page = pages[side];
      await page.clock.runFor(4000); // past the entrance
      states[side].push(await settled(page)); // at rest
      await page.mouse.move(300, 700);
      await page.clock.runFor(100);
      states[side].push(await settled(page)); // cursor away from the name
      const name = (await page.locator('.nmh .nm').boundingBox())!;
      await page.mouse.move(name.x + name.width * 0.7, name.y + name.height * 0.4);
      await page.clock.runFor(100);
      states[side].push(await settled(page)); // split hover
      await page.mouse.move(1200, 120);
      await page.evaluate(() => window.scrollTo(0, 1400));
      // The scroll event fires on a later real frame; its throttled rAF then needs fake time.
      await expect
        .poll(async () => {
          await page.clock.runFor(20);
          return page.evaluate(() => document.documentElement.style.getPropertyValue('--sp'));
        })
        .toMatch(/^0\.[1-9]/);
      states[side].push(await settled(page)); // scrolled, cursor elsewhere
    }
    expect(states.site, reduced ? 'reduced motion' : 'full motion').toEqual(states.board);
  }
});
