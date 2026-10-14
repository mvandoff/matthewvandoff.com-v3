import { expect, test } from '@playwright/test';
import { fontCoverage } from '../helpers/fonts.ts';

/**
 * DotGothic16 is subset to the glyphs the site renders in it. If copy set in
 * DotGothic16 gains a character the subset lacks, the browser would silently fall
 * back to a system font; this fails instead. Fix: run `pnpm fonts`.
 */
test('every character rendered in DotGothic16 is in the subset font', async ({ page }) => {
  await page.goto('/');
  const rendered: string = await page.evaluate(() => {
    let text = '';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent) continue;
      const family = getComputedStyle(parent).fontFamily.replace(/["']/g, '').split(',')[0]!.trim();
      if (family === 'DotGothic16') text += node.textContent ?? '';
    }
    return text;
  });

  const glyphs = [...new Set(rendered.replace(/\s/g, ''))];
  expect(glyphs.length).toBeGreaterThan(10);

  const covered = fontCoverage('public/fonts/DotGothic16-subset.woff2');
  expect(glyphs.filter((glyph) => !covered(glyph))).toEqual([]);
});
