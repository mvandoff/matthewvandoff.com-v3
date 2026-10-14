import { expect, test, type Page } from '@playwright/test';
import { BOARD_URL, serveBoard } from './board.ts';
import { freeze, prepare } from './freeze.ts';
import { WIDTHS } from './widths.ts';

/**
 * Design accuracy: the built site against the Warm Terminal board, both in the frozen
 * state from freeze.ts. Pixel baselines are committed (`pnpm design:baselines`);
 * the computed-style checks render the board live and compare the same elements.
 */

// Per-pixel colour tolerance is Playwright's default-ish YIQ threshold; the ratio is how
// much of the page may still differ. Tuned in build-notes.md ("Design harness").
const DIFF = { threshold: 0.1, maxDiffPixelRatio: 0.0003 };

for (const { name, width, height } of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height } });

    test(`full page matches the board`, async ({ page }) => {
      await prepare(page);
      await page.goto('/');
      await freeze(page);
      await expect(page).toHaveScreenshot(`board-${name}.png`, { fullPage: true, ...DIFF });
    });
  });
}

type Probe = { selector: string; props: string[]; parent?: boolean };
const TEXT = ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight', 'color'];

const PROBES: Record<string, Probe> = {
  'page ground and ink': { selector: '#top', props: ['backgroundColor', 'color', 'fontFamily', 'fontSize', 'lineHeight'] },
  'name': { selector: '.nmh .nm', props: TEXT },
  'Section heading': { selector: '.sh > span:last-child > span:first-child', props: TEXT },
  'Episode title': { selector: '.ep-t', props: TEXT },
  'about body': { selector: '.ab-p', props: TEXT },
  'Episode number': { selector: '.ep > :nth-child(1)', props: TEXT },
  'Episode description': { selector: '.ep > :nth-child(4)', props: [...TEXT, 'marginTop'] },
  'Cel label': { selector: 'a.cel .vlabel', props: ['fontSize', 'writingMode', 'transform'] },
  'Cel': { selector: 'a.cel', props: ['flexDirection', 'minHeight', 'paddingLeft', 'paddingRight'] },
  'Terminal input': { selector: '#term-in', props: TEXT },
  'Terminal hint': { selector: '.t-hint', props: TEXT },
  'Terminal body': { selector: '.now dd', props: TEXT },
  'header prompt Accent': { selector: '.prompt > span', props: ['color'] },
  'Section number Accent': { selector: '.sh-n > span:first-child', props: ['color'] },
  'Cel rule colour': { selector: 'a.cel', props: ['borderTopColor', 'borderTopWidth', 'backgroundColor'] },
  'Episode rule colour': { selector: '.ep', props: ['borderTopColor', 'borderBottomColor'] },
  'Strip': { selector: '.strip', props: ['height', 'columnGap', 'rowGap'] },
  'container': { selector: '.strip', parent: true, props: ['maxWidth', 'paddingLeft', 'paddingRight', 'width'] },
};

async function probe(page: Page) {
  return page.evaluate((probes) => {
    const result: Record<string, Record<string, string>> = {};
    for (const [label, { selector, props, parent }] of Object.entries(probes)) {
      let el = document.querySelector(selector);
      if (el && parent) el = el.parentElement;
      if (!el) {
        result[label] = { missing: selector };
        continue;
      }
      const style = getComputedStyle(el) as unknown as Record<string, string>;
      result[label] = Object.fromEntries(props.map((p) => [p, style[p] ?? '']));
    }
    return result;
  }, PROBES);
}

for (const { width, height } of WIDTHS) {
  test.describe(`computed styles at ${width}px`, () => {
    test.use({ viewport: { width, height } });

    test('key elements match the board', async ({ page, browser }) => {
      await prepare(page);
      await page.goto('/');
      await freeze(page);
      const site = await probe(page);

      const boardPage = await (await browser.newContext({ viewport: { width, height } })).newPage();
      await serveBoard(boardPage);
      await prepare(boardPage);
      await boardPage.goto(BOARD_URL);
      await freeze(boardPage);
      const board = await probe(boardPage);

      for (const label of Object.keys(PROBES)) {
        expect.soft(site[label], label).toEqual(board[label]);
      }
    });
  });
}
