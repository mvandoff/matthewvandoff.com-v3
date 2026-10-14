/**
 * Regenerates the self-hosted font subsets in public/fonts from upstream sources.
 *
 *   pnpm fonts
 *
 * Sources are pinned to one commit of the google/fonts repository (all OFL-1.1);
 * downloads are cached in .font-cache/. Subsetting uses harfbuzz (subset-font).
 * Gridular is not generated: public/fonts/Gridular-Regular.woff2 is copied from v2.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';
import { dotGothicText, fontFiles } from '../src/lib/fonts.ts';

const GOOGLE_FONTS_COMMIT = '66928797f271fed5ee428544e7229685e2d90127';
const upstream = (path: string) =>
  `https://raw.githubusercontent.com/google/fonts/${GOOGLE_FONTS_COMMIT}/${path}`;

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = join(appDir, '.font-cache');
const publicDir = join(appDir, 'public');
const licenseDir = join(appDir, 'fonts', 'licenses');

/** Every code point from `from` to `to`, inclusive, as a string. */
function range(from: number, to: number): string {
  let out = '';
  for (let cp = from; cp <= to; cp++) out += String.fromCodePoint(cp);
  return out;
}

/** Google Fonts' "latin" subset (its unicode-range), used for Geist. */
const LATIN =
  range(0x0000, 0x00ff) +
  String.fromCodePoint(0x0131, 0x0152, 0x0153, 0x02bb, 0x02bc, 0x02c6, 0x02da, 0x02dc) +
  String.fromCodePoint(0x0304, 0x0308, 0x0329) +
  range(0x2000, 0x206f) +
  String.fromCodePoint(0x20ac, 0x2122, 0x2191, 0x2193, 0x2212, 0x2215, 0xfeff, 0xfffd);

/**
 * Google Fonts' "latin-ext" subset. Martian Mono keeps latin + latin-ext, exactly
 * the subsets the board gets from Google Fonts, so characters outside them
 * (→ ↗ ■ ▶ ⌐ in the Terminal and ASCII art) fall back to ui-monospace as they
 * do on the board.
 */
const LATIN_EXT =
  range(0x0100, 0x02ba) +
  range(0x02bd, 0x02c5) +
  range(0x02c7, 0x02cc) +
  range(0x02ce, 0x02d7) +
  range(0x02dd, 0x02ff) +
  String.fromCodePoint(0x0304, 0x0308, 0x0329) +
  range(0x1d00, 0x1dbf) +
  range(0x1e00, 0x1e9f) +
  range(0x1ef2, 0x1eff) +
  String.fromCodePoint(0x2020) +
  range(0x20a0, 0x20ab) +
  range(0x20ad, 0x20c4) +
  String.fromCodePoint(0x2113) +
  range(0x2c60, 0x2c7f) +
  range(0xa720, 0xa7ff);

interface FontJob {
  name: string;
  source: string;
  license: string;
  out: string;
  text: string;
  variationAxes?: Record<string, number | { min: number; max: number; default?: number }>;
}

const jobs: FontJob[] = [
  {
    name: 'DotGothic16',
    source: 'ofl/dotgothic16/DotGothic16-Regular.ttf',
    license: 'ofl/dotgothic16/OFL.txt',
    out: fontFiles.dotGothic16,
    // Exactly the glyphs the site renders in DotGothic16 (plus a space).
    text: ' ' + dotGothicText(),
  },
  {
    name: 'MartianMono',
    source: 'ofl/martianmono/MartianMono[wdth,wght].ttf',
    license: 'ofl/martianmono/OFL.txt',
    out: fontFiles.martianMono,
    text: LATIN + LATIN_EXT,
    // Width pinned to 100 (normal), which is what Google Fonts serves the board
    // (the source's own default is 112.5, semi-expanded). The board requests
    // wght 300..800; the site uses 400, but keeping the axis means any bold
    // renders true rather than synthesised.
    variationAxes: { wdth: 100, wght: { min: 300, max: 800, default: 400 } },
  },
  {
    name: 'Geist',
    source: 'ofl/geist/Geist[wght].ttf',
    license: 'ofl/geist/OFL.txt',
    out: fontFiles.geist,
    text: LATIN,
    variationAxes: { wght: 400 },
  },
];

async function fetchCached(path: string): Promise<Buffer> {
  const file = join(cacheDir, GOOGLE_FONTS_COMMIT, path);
  try {
    return await readFile(file);
  } catch {
    const url = upstream(path.split('/').map(encodeURIComponent).join('/'));
    const response = await fetch(url);
    if (!response.ok) throw new Error(`GET ${url}: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, buffer);
    return buffer;
  }
}

await mkdir(licenseDir, { recursive: true });
for (const job of jobs) {
  const source = await fetchCached(job.source);
  const subset = await subsetFont(source, job.text, {
    targetFormat: 'woff2',
    ...(job.variationAxes ? { variationAxes: job.variationAxes } : {}),
  });
  const out = join(publicDir, job.out);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, subset);
  await writeFile(join(licenseDir, `${job.name}-OFL.txt`), await fetchCached(job.license));
  console.log(`${job.out}  ${(subset.length / 1024).toFixed(1)} KB`);
}
