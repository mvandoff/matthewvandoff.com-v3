import { expect, test, type Page } from '@playwright/test';
import { open, type Side } from './board.ts';

/**
 * Pointer-driven effects against the live board: drive the same mouse positions,
 * hovers and focus on both, let every transition land, and compare the computed
 * styles and boxes of the Crosshair, HUD, Cels, Episodes and the scramble frames.
 *
 * Not compared here: the HUD x/y digits, which the board prints with CSS counters
 * (unreadable from script) and the site writes as text; their boxes are compared,
 * and the pixels were checked by hand (see build-notes for mvd-034.8).
 */

test.use({ viewport: { width: 1440, height: 900 } });

const PROPS: Record<string, string[]> = {
  '.xh': ['display', 'opacity', 'zIndex', 'transition'],
  '.xh-v': ['transform', 'backgroundColor', 'width', 'height'],
  '.xh-h': ['transform', 'backgroundColor', 'width', 'height'],
  '.xh-s': ['transform', 'left', 'top', 'width', 'height'],
  '.xh-s::before': ['top', 'left', 'right', 'bottom', 'borderTopColor', 'borderTopWidth', 'backgroundColor', 'transition'],
  '.hud': ['transform', 'backgroundColor', 'backdropFilter', 'color', 'fontFamily', 'fontSize', 'letterSpacing', 'padding'],
  '.hud-k': ['color'],
  '.hud-v.vx': ['color', 'fontSize', 'lineHeight', 'width'],
  '.hud-rl.rx': ['backgroundImage', 'width', 'height'],
  '.hud-rl.rx i': ['left', 'boxShadow', 'height'],
  '.hud-rl.ry i': ['left'],
  '.hud-map': ['borderTopColor', 'backgroundImage'],
  '.hud-map .mv': ['left', 'backgroundColor'],
  '.hud-map .mh': ['top', 'backgroundColor'],
  '.hud-map .md': ['left', 'top'],
  '.hud-map .mr': ['left', 'top', 'opacity', 'transform', 'borderTopColor'],
  '.hud-map .ms': ['top', 'height', 'backgroundColor'],
  'a.cel[href="#about"]': ['borderTopColor', 'color', 'transition'],
  'a.cel[href="#about"] .vlabel': ['color'],
  'a.cel[href="#about"] .hov': ['clipPath', 'backgroundImage', 'maskImage', 'transition'],
  'a.cel[href="#experience"]': ['borderTopColor'],
  'a.cel[href="#experience"] .vlabel': ['color'],
  'a.cel[href="#experience"] .hov': ['clipPath'],
  '.ep': ['backgroundColor', 'transition'],
  '.ep .ep-t': ['color', 'transition'],
  'a.big': ['color', 'transition'],
  'a.big .nz': ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'color'],
};
const BOXES = ['.xh-s', '.hud', '.hud-ax.ax-x', '.hud-v.vx', '.hud-v.vy', '.hud-map', 'a.big', 'a.big .dw-live'];

/** Computed styles and boxes once every running transition has landed. */
const settled = (page: Page) =>
  page.evaluate(
    ({ props, boxes }) => {
      for (const a of document.getAnimations()) if (!(a as CSSAnimation).animationName) a.finish();
      const out: Record<string, unknown> = {};
      for (const [key, names] of Object.entries(props)) {
        const [sel, pseudo] = key.split('::');
        const el = document.querySelector(sel!);
        if (!el) {
          out[key] = 'absent';
          continue;
        }
        const style = getComputedStyle(el, pseudo ? `::${pseudo}` : null) as unknown as Record<string, string>;
        out[key] = Object.fromEntries(
          names.map((n) => [n, n === 'transition' && style['transitionProperty'] === 'none' ? 'none' : style[n]]),
        );
      }
      for (const sel of boxes) {
        const el = document.querySelector(sel);
        const r = el?.getBoundingClientRect();
        out[`box ${sel}`] = r && r.width ? [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 4) / 4) : 'none';
      }
      return out;
    },
    { props: PROPS, boxes: BOXES },
  );

/** Scrolls to the top or bottom and waits until scroll tracking has caught up. */
async function scrollTo(page: Page, where: 'top' | 'bottom') {
  const jump = () =>
    page.evaluate((w) => window.scrollTo(0, w === 'top' ? 0 : document.documentElement.scrollHeight), where);
  // The scroll event fires on a later real frame; its throttled rAF then needs fake time.
  // Jumping again on every poll keeps us at the end if late-loading fonts change the page height.
  await expect
    .poll(async () => {
      await jump();
      await page.clock.runFor(20);
      const sp = Number(await page.evaluate(() => document.documentElement.style.getPropertyValue('--sp')));
      return where === 'top' ? sp === 0 : sp > 0.99;
    })
    .toBe(true);
}

/** The same sequence of pointer states on one side; returns a snapshot per state. */
async function drive(page: Page) {
  const states: Record<string, unknown> = {};
  const snap = async (label: string) => {
    await page.clock.runFor(50);
    states[label] = await settled(page);
  };
  await page.clock.runFor(4000); // past the entrance
  await page.evaluate(() => document.fonts.ready);
  // Scroll through once so the board reveals every Section (as the design freeze does).
  await scrollTo(page, 'bottom');
  await scrollTo(page, 'top');
  await snap('at rest, mouse never moved');
  await page.mouse.move(700, 880);
  await snap('empty space below the Strip');
  await page.locator('a.cel[href="#experience"]').hover({ position: { x: 20, y: 300 } });
  await snap('over the experience Cel');
  await page.locator('.cel.sig').hover({ position: { x: 200, y: 60 } });
  await snap('over the Terminal');
  await page.locator('a.cel[href="#about"]').focus();
  await page.mouse.move(700, 880);
  await snap('about Cel focused, mouse away');
  await page.locator('.ep').first().scrollIntoViewIfNeeded();
  await page.locator('.ep').first().hover({ position: { x: 600, y: 20 } });
  await snap('over the first Episode');
  await scrollTo(page, 'bottom');
  await page.mouse.move(1100, 300);
  await snap('scrolled to the footer');
  await page.mouse.move(1100, 300);
  await page.locator('html').dispatchEvent('mouseout', { relatedTarget: null });
  await snap('mouse left the window');
  return states;
}

test('Crosshair, HUD, Cel and Episode hover states match the board', async ({ browser }) => {
  const site = await drive(await open(browser, 'site'));
  const board = await drive(await open(browser, 'board'));
  for (const label of Object.keys(board)) expect.soft(site[label], label).toEqual(board[label]);
});

test('with reduced motion there is no Crosshair, and hovers apply instantly', async ({ browser }) => {
  const site = await drive(await open(browser, 'site', { reduced: true }));
  const board = await drive(await open(browser, 'board', { reduced: true }));
  for (const label of Object.keys(board)) {
    const strip = (s: unknown) =>
      Object.fromEntries(Object.entries(s as Record<string, unknown>).filter(([k]) => !/xh|hud/.test(k)));
    expect.soft(strip(site[label]), label).toEqual(strip(board[label]));
    // The board doesn't render the Crosshair at all; the site's is display:none.
    expect.soft((site[label] as Record<string, unknown>)['.xh'], label).toMatchObject({ display: 'none' });
    expect.soft((board[label] as Record<string, unknown>)['.xh'], label).toBe('absent');
  }
});

/** The github or linkedin word, frame by frame, from hover/focus until it resolves. */
async function scrambleFrames(page: Page, name: string, trigger: 'hover' | 'focus') {
  await page.clock.runFor(4000);
  const link = page.locator(`a.big[aria-label="${name}"]`);
  await link.scrollIntoViewIfNeeded();
  await (trigger === 'hover' ? link.hover() : link.focus());
  const frames: string[] = [];
  for (let i = 0; i < 16; i++) {
    // "<resolved prefix>|<noise tail>"
    const frame = await link
      .locator('.dw-live')
      .evaluate((el) => `${el.childNodes[0]?.textContent ?? ''}|${el.querySelector('.nz')?.textContent ?? ''}`);
    frames.push(frame);
    await page.clock.runFor(34);
  }
  return frames;
}

for (const [name, trigger] of [
  ['github', 'hover'],
  ['linkedin', 'focus'],
] as const) {
  test(`the ${name} scramble on ${trigger} runs frame for frame like the board`, async ({ browser }) => {
    for (const random of [0.1, 0.73]) {
      const site = await scrambleFrames(await open(browser, 'site', { random }), name, trigger);
      const board = await scrambleFrames(await open(browser, 'board', { random }), name, trigger);
      expect(site).toEqual(board);
      expect(board[0]).toMatch(/^\|.+/); // sanity: the comparison saw noise
    }
  });
}
