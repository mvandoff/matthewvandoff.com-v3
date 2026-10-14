import { expect, test, type Browser, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tune } from '../../src/lib/accent.ts';
import { open, type Side } from './board.ts';

/**
 * Accent against the live board.
 *
 * 1. Tuning: the board's own tune() (cut verbatim from its source and run in
 *    Chromium) and the site's tune() (src/lib/accent.ts, given Chromium's colour
 *    parsing) must give the same hex for a sweep of inputs.
 * 2. The command end to end: the same `accent` inputs typed into both Terminals
 *    must print the same lines and leave every Accent-tinted element (Accent and
 *    second/third colours) the same computed colour.
 */

test.use({ viewport: { width: 1440, height: 900 } });

const BOARD_SOURCE = fileURLToPath(new URL('../../../design/reference/warm-terminal.html', import.meta.url));

/** The board's tune(n) method, as source for `new Function`. */
async function boardTuneSource(): Promise<string> {
  const html = await readFile(BOARD_SOURCE, 'utf8');
  const start = html.indexOf('  tune(n) {');
  const end = html.indexOf('  termRun(raw) {');
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end).trim().replace(/^tune\(n\) \{/, 'return function tune(n) {') + ';';
}

/** A deterministic spread of 6-digit hex colours. */
function hexSweep(count: number): string[] {
  let x = 0x2f6b1d;
  return Array.from({ length: count }, () => {
    x = (x * 1103515245 + 12345) % 0x1000000;
    return '#' + x.toString(16).padStart(6, '0');
  });
}

const NAMED = [
  'red', 'orange', 'yellow', 'lime', 'green', 'teal', 'cyan', 'blue', 'navy', 'purple', 'magenta', 'pink',
  'brown', 'maroon', 'olive', 'coral', 'salmon', 'tomato', 'gold', 'khaki', 'orchid', 'plum', 'indigo',
  'crimson', 'chartreuse', 'turquoise', 'skyblue', 'steelblue', 'slategray', 'rebeccapurple', 'hotpink',
  'peachpuff', 'lavender', 'mintcream', 'beige', 'tan', 'sienna', 'gray', 'silver', 'white', 'black',
  'transparent', 'currentcolor',
];

const SWEEP = [
  ...NAMED,
  ...Array.from({ length: 361 }, (_, h) => String(h)),
  '0deg', '12.5', '90.4deg', '359.99', '360.0', '361', '400', '999', '1234', '361deg',
  '3af', '#3af', 'abc', 'fff', '000', 'abcdef', '#abcdef', '#12', '#ff000080', 'ff8800',
  'rgb(10,200,90)', 'rgb(255 0 0 / 50%)', 'rgba(0,0,255,.3)', 'hsl(200 15% 50%)', 'hsl(200 5% 50%)',
  'hsl(330deg 80% 40%)', 'hwb(90 10% 10%)', 'oklch(0.7 0.2 30)', 'lab(50 40 -20)', 'color(display-p3 1 0 0)',
  'nope', 'dark red', '', 'reset',
  ...hexSweep(200),
];

test('tune() gives the same hex as the board for a sweep of inputs', async ({ page }) => {
  const source = await boardTuneSource();
  const { board, parsed } = await page.evaluate(
    ({ source, inputs }) => {
      const boardTune = new Function(source)() as (n: string) => { hex: string; label: string } | null;
      const parse = (css: string) => {
        if (!CSS.supports('color', css)) return null;
        const ctx = document.createElement('canvas').getContext('2d')!;
        ctx.fillStyle = '#010203';
        ctx.fillStyle = css;
        return String(ctx.fillStyle);
      };
      const hexed = (n: string) => (/^[0-9a-f]{3}$|^[0-9a-f]{6}$/.test(n) ? '#' + n : n);
      return {
        board: inputs.map((n) => boardTune(n)),
        parsed: Object.fromEntries(inputs.map((n) => [hexed(n), parse(hexed(n))])),
      };
    },
    { source, inputs: SWEEP },
  );
  const site = SWEEP.map((n) => tune(n, { parseColour: (css) => parsed[css] ?? null, random: () => 0.1 }));
  // `random` is excluded from the sweep (the board's uses Math.random); the Terminal test covers it.
  expect(site).toEqual(board);
  expect(board.filter(Boolean).length).toBeGreaterThan(600);
});

/**
 * Accent-tinted elements present on both sides (structural selectors where the
 * board has no class). Lock-on is left out: the board mounts it only while
 * locking (tests/design/navigation.spec.ts compares it).
 */
const TINTED: Array<[string, string, string, string?]> = [
  ['header prompt', '.prompt > span', 'color'],
  ['progress line', '.prog', 'backgroundColor'],
  ['role line', '.nmh + div > div > p:first-child', 'color'],
  ['name ghost a', '.gh.ga', 'color'],
  ['name ghost b (second)', '.gh.gb', 'color'],
  ['ascii (second)', '.aq', 'color'],
  ['Name card blob a', '.lb.a', 'backgroundImage'],
  ['Name card blob b (second)', '.lb.b', 'backgroundImage'],
  ['Name card blob c (third)', '.lb.c', 'backgroundImage'],
  ['field blob a', '.blob.a', 'backgroundImage'],
  ['field blob b (second)', '.blob.b', 'backgroundImage'],
  ['cursor', '.cur', 'backgroundColor'],
  ['input caret', '#term-in', 'caretColor'],
  ['Terminal output accent', '.t-acc', 'color'],
  ['Section number', '.sh-n > span:first-child', 'color'],
  ['Section rule', '.sh-r', 'backgroundColor', '::after'],
  ['Section kana', '#about .sh > span:last-child > span:last-child', 'color'],
  ['about accent clause', '.ab .acc', 'color'],
  ['Episode number', '.ep-n', 'color'],
  ['Episode company (second)', '.ep > div > p', 'color'],
  ['links arrow', '.big > span:last-child', 'color'],
  ['links noise', '.nz', 'color'],
  ['Cel hover wash', 'a.cel .hov', 'backgroundImage'],
  ['HUD key', '.hud-k', 'color'],
  ['HUD minimap scroll (second)', '.hud-map .ms', 'backgroundColor'],
  ['crosshair line', '.xh-v', 'backgroundColor'],
  ['crosshair square', '.xh-s', 'borderTopColor', '::before'],
];

const tinted = (page: Page) =>
  page.evaluate((probes) => {
    const out: Record<string, string> = {};
    for (const [label, selector, prop, pseudo] of probes) {
      const el = document.querySelector(selector);
      out[label] = el ? (getComputedStyle(el, pseudo ?? null) as unknown as Record<string, string>)[prop]! : 'missing';
    }
    return out;
  }, TINTED);

async function runAll(browser: Browser, side: Side, inputs: string[]) {
  const page = await open(browser, side);
  const input = page.locator('#term-in');
  const results: Array<{ input: string; lines: string; colours: Record<string, string> }> = [];
  for (const command of inputs) {
    await input.fill(command);
    await input.press('Enter');
    await expect(page.locator('#term-body .t-ln').first()).toBeVisible();
    await input.blur(); // the board only mounts the block cursor while the input is unfocused
    results.push({
      input: command,
      lines: await page.locator('#term-body').innerText(),
      colours: await tinted(page),
    });
  }
  await page.context().close();
  return results;
}

test('the accent command prints and recolours the same as the board', async ({ browser }) => {
  const inputs = [
    'accent',
    'accent red',
    'accent lilac',
    'accent 30',
    'accent',
    'accent nope',
    'accent random',
    'accent #3AF',
    'accent gray',
    'accent hsl(200 15% 50%)',
    'accent reset',
    'accent',
  ];
  const [board, site] = await Promise.all([runAll(browser, 'board', inputs), runAll(browser, 'site', inputs)]);
  for (let i = 0; i < inputs.length; i++) {
    expect.soft(site[i]!.lines, inputs[i]).toBe(board[i]!.lines);
    expect.soft(site[i]!.colours, inputs[i]).toEqual(board[i]!.colours);
  }
  // Sanity: every probe found an element, and `accent red` really changed them.
  for (const [label, colour] of Object.entries(site[1]!.colours)) {
    expect.soft(colour, label).not.toBe('missing');
    expect.soft(colour, label).not.toBe(site[0]!.colours[label]);
  }
});
