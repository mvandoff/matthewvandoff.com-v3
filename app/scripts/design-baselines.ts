/**
 * Regenerates the committed design baselines from design/reference/ (needs network:
 * the board loads Google Fonts). Run with `pnpm design:baselines`, then commit
 * tests/design/baselines/.
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { BOARD_URL, serveBoard } from '../tests/design/board.ts';
import { freeze, prepare } from '../tests/design/freeze.ts';
import { WIDTHS } from '../tests/design/widths.ts';

const outDir = fileURLToPath(new URL('../tests/design/baselines/', import.meta.url));
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
for (const { name, width, height } of WIDTHS) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await serveBoard(page);
  await prepare(page);
  await page.goto(BOARD_URL);
  await freeze(page);
  await page.screenshot({ path: `${outDir}board-${name}.png`, fullPage: true });
  console.log(`board-${name}.png`);
  await context.close();
}
await browser.close();
