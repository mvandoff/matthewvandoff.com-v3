/**
 * Self-hosted font files and the glyph sets they are subset to.
 * `pnpm fonts` (scripts/build-fonts.ts) regenerates the subset files from upstream;
 * the layout's @font-face rules (src/styles/fonts.css) point at the same paths.
 */
import { episodeLabel, site } from './content.ts';

/** Public URL paths, relative to the site root. */
export const fontFiles = {
  gridular: '/fonts/Gridular-Regular.woff2',
  martianMono: '/fonts/MartianMono-var.woff2',
  dotGothic16: '/fonts/DotGothic16-subset.woff2',
  geist: '/fonts/Geist-latin-400.woff2',
} as const;

/**
 * Every string the site sets in DotGothic16: the katakana name, the Terminal's
 * 現在, each Section's Japanese label and the Episode numbers ("ep." plus digits).
 */
export function dotGothicText(): string {
  return [
    site.nameCard.katakana,
    site.terminal.jp,
    ...site.sections.map((section) => section.jp),
    ...site.episodes.map(episodeLabel),
    // All ten digits, so renumbering Episodes never needs a regenerated font.
    '0123456789',
  ].join('');
}

/** The distinct characters in `dotGothicText()`, sorted by code point. */
export function dotGothicGlyphs(): string[] {
  return [...new Set(dotGothicText())].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!);
}
