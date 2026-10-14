/** Serves design/reference/ to a page on a fake origin, so no server process is needed. */
import type { Page } from '@playwright/test';
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
