/**
 * The frozen state shared by the board (reference) and the site.
 *
 * Both sides go through exactly these two functions, so a difference in a diff
 * is a difference in the page, never in the capture. See build-notes.md
 * ("Design harness") for what later motion work must keep true.
 */
import type { Page } from '@playwright/test';

/** The wall-clock instant both pages show once frozen. */
export const FROZEN_TIME = new Date(2026, 9, 14, 9, 30, 5);
/** Fake time the page's timers get to run before the capture (boot, intro, scramble...). */
export const SETTLE_MS = 8000;

/** What the harness hides. `[data-freeze-hide]` is the site's hook; `.xh`/`.boot`/`.tx*` are the board's. */
const HIDE_CSS = `
  [data-freeze-hide], .xh, .boot, .txf, .txb, .hud { display: none !important; }
  *, *::before, *::after { caret-color: transparent !important; scroll-behavior: auto !important; }
`;

/** Call before `page.goto`. Fixes the clock and the random source. */
export async function prepare(page: Page): Promise<void> {
  // Start early by SETTLE_MS so that, after the timers have run, the clock reads FROZEN_TIME.
  await page.clock.install({ time: new Date(FROZEN_TIME.getTime() - SETTLE_MS) });
  await page.addInitScript(() => {
    // A constant source: ASCII coin flip -> fish, scramble glyphs, hues all deterministic.
    Math.random = () => 0.1;
  });
}

/** Call after load. Leaves the page in its settled end state, scrolled to the top. */
export async function freeze(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);

  // Reveal-on-scroll: walk the whole page so every Section's observer fires.
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += 300) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(50);
  }
  await page.evaluate(() => window.scrollTo(0, 0));

  // Run every pending timer, interval and rAF (Boot, glitch, scramble, clock) to the end.
  await page.clock.runFor(SETTLE_MS);
  await page.waitForTimeout(100);

  await page.addStyleTag({ content: HIDE_CSS });
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-freeze', '');
    for (const anim of document.getAnimations()) {
      const timing = anim.effect?.getComputedTiming();
      if (timing && timing.iterations === Infinity) {
        // Looping ambience (blink, drift, swim): park at the first frame on both sides.
        anim.pause();
        anim.currentTime = 0;
      } else {
        anim.finish(); // animations and transitions jump to their end state
      }
    }
  });
  await page.evaluate(() => document.fonts.ready);
}
