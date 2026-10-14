import { describe, expect, test } from 'vitest';
import { dotGothicGlyphs } from '../../src/lib/fonts.ts';
import { fontCoverage } from '../helpers/fonts.ts';

describe('the DotGothic16 subset', () => {
  test('covers every Japanese label and Episode number in the content module', () => {
    const covered = fontCoverage('public/fonts/DotGothic16-subset.woff2');
    expect(dotGothicGlyphs().filter((glyph) => !covered(glyph))).toEqual([]);
  });

  test('is limited to those glyphs', () => {
    const covered = fontCoverage('public/fonts/DotGothic16-subset.woff2');
    // A kanji the site never sets in DotGothic16.
    expect(covered('猫')).toBe(false);
  });
});
