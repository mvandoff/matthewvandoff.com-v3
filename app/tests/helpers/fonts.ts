import { openSync, type Font } from 'fontkit';

/** Returns a predicate: does the font file at `path` have a glyph for this character? */
export function fontCoverage(path: string): (char: string) => boolean {
  const font = openSync(path) as Font;
  return (char) => font.hasGlyphForCodePoint(char.codePointAt(0)!);
}
