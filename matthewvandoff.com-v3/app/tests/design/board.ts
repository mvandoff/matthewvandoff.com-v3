/** Serves design/reference/ to a page on a fake origin, so no server process is needed. */
import type { Browser, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BOARD_ORIGIN = 'https://board.local';
export const BOARD_URL = `${BOARD_ORIGIN}/warm-terminal.html`;
const REFERENCE_DIR = fileURLToPath(new URL('../../../design/reference/', import.meta.url));
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
};

export async function serveBoard(page: Page): Promise<void> {
  await page.route(`${BOARD_ORIGIN}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    try {
      const body = await readFile(join(REFERENCE_DIR, path));
      await route.fulfill({ body, contentType: TYPES[extname(path)] ?? 'application/octet-stream' });
    } catch {
      await route.fulfill({ status: 404 });
    }
  });
}

export type Side = 'site' | 'board';
export const START = new Date(2026, 9, 14, 9, 30, 0);

/**
 * A fresh 1440x900 page on the site or the board, on a paused fake clock (tests
 * advance it with runFor) and with Math.random fixed (default 0.1).
 */
export async function open(browser: Browser, side: Side, opts: { random?: number; reduced?: boolean } = {}) {
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
