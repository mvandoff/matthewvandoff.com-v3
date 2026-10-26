/**
 * Renders the Open Graph / Twitter card image (public/og-image.png, 1200×630): the
 * Name card, laid out for a share preview.
 *
 *   pnpm og
 *
 * It builds an HTML page from the site's own pieces (the design tokens in
 * src/styles/tokens.css, the self-hosted fonts in public/, the Name card copy in
 * src/lib/content.ts, the origin in astro.config.mjs) and screenshots it with Playwright's Chromium. Run it after
 * changing any of those, then commit the PNG.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import astroConfig from '../astro.config.mjs';
import { site } from '../src/lib/content.ts';
import { fontFiles } from '../src/lib/fonts.ts';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(appDir, 'public');
const { shareImage } = site.meta;
const { nameCard } = site;

/** Escapes text for HTML element content. */
const html = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** An @font-face rule with the font inlined, so the page needs no server. */
async function fontFace(family: string, path: string, weight: string): Promise<string> {
  const data = (await readFile(join(publicDir, path))).toString('base64');
  return `@font-face { font-family: '${family}'; src: url(data:font/woff2;base64,${data}) format('woff2'); font-weight: ${weight}; }`;
}

async function page(): Promise<string> {
  const tokens = await readFile(join(appDir, 'src/styles/tokens.css'), 'utf8');
  const faces = await Promise.all([
    fontFace('Gridular', fontFiles.gridular, '100 900'),
    fontFace('Martian Mono', fontFiles.martianMono, '300 800'),
    fontFace('DotGothic16', fontFiles.dotGothic16, '400'),
  ]);
  const name = nameCard.nameLines.map((line) => `<span class="ln">${html(line)}</span>`).join('');
  const host = new URL(astroConfig.site!).host.replace(/^www\./, '');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
${faces.join('\n')}
${tokens}
html, body { margin: 0; }
body {
  width: ${shareImage.width}px;
  height: ${shareImage.height}px;
  box-sizing: border-box;
  padding: 32px;
  background: var(--ground);
  color: var(--ink);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}
.card {
  position: relative;
  box-sizing: border-box;
  height: 100%;
  overflow: hidden;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 40px 56px 44px;
  border: 1px solid var(--rule-2);
  background: var(--ground-2);
}
/* The Name card's Accent blobs, held still. No grain: it barely shows at this size and quadruples the PNG. */
.bg { position: absolute; inset: 0; z-index: -1; }
.blobs { position: absolute; inset: 0; filter: saturate(0.65); opacity: 0.3; }
.lb { position: absolute; border-radius: 50%; }
.lb.a { width: 70%; height: 110%; left: -12%; top: -34%;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--accent) 30%, transparent), transparent); }
.lb.b { width: 62%; height: 100%; right: -14%; bottom: -40%;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--second) 26%, transparent), transparent); }
.lb.c { width: 44%; height: 70%; left: 34%; top: 16%;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--third) 14%, transparent), transparent); }

.row { display: flex; justify-content: space-between; align-items: center; gap: 24px;
  font-size: 22px; letter-spacing: 0.06em; color: var(--dim); }
.kana { position: absolute; right: 22px; top: 50%; transform: translateY(-50%);
  writing-mode: vertical-rl; font-family: var(--font-jp); font-size: 20px; letter-spacing: 0.35em;
  color: var(--dim); opacity: 0.6; white-space: nowrap; }

/* The name, with its two Accent ghosts pulled apart as on hover. */
.nmh { position: relative; margin: 0; text-align: center; font-family: var(--font-display); font-weight: 600;
  font-size: 156px; line-height: 0.9; letter-spacing: -0.05em; isolation: isolate; }
.nm, .gh { display: block; white-space: nowrap; }
.gh { position: absolute; inset: 0 0 auto; z-index: -1; opacity: 0.55; color: var(--accent); }
.gh.ga { transform: translate(-5px, -1px); }
.gh.gb { transform: translate(5px, 1px); color: var(--second); }
.ln { display: block; padding-bottom: 0.04em; }

.bottom { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
.role { margin: 0 0 8px; font-size: 34px; letter-spacing: 0.02em; color: var(--accent); }
.line { margin: 0; font-size: 24px; color: var(--ink-2); }
.fish { font-size: 30px; color: var(--second); white-space: pre; margin-right: 40px; }
</style>
</head>
<body>
<div class="card">
  <div class="bg">
    <div class="blobs"><div class="lb a"></div><div class="lb b"></div><div class="lb c"></div></div>
  </div>
  <span class="kana" lang="ja">${html(nameCard.katakana)}</span>
  <div class="row"><span>${html(nameCard.prompt)}</span><span>${html(host)}</span></div>
  <h1 class="nmh">
    <span class="gh ga">${name}</span><span class="gh gb">${name}</span><span class="nm">${name}</span>
  </h1>
  <div class="bottom">
    <div><p class="role">${html(nameCard.role)}</p><p class="line">${html(nameCard.tagline)}</p></div>
    <span class="fish">${html(nameCard.ascii.fish.art)}</span>
  </div>
</div>
</body>
</html>`;
}

const browser = await chromium.launch();
try {
  const tab = await browser.newPage({
    viewport: { width: shareImage.width, height: shareImage.height },
    deviceScaleFactor: 1,
  });
  await tab.setContent(await page());
  await tab.evaluate(() => document.fonts.ready);
  const missing = await tab.evaluate(() =>
    [...document.fonts].filter((font) => font.status !== 'loaded').map((font) => font.family),
  );
  if (missing.length) throw new Error(`fonts did not load: ${missing.join(', ')}`);
  const out = join(publicDir, shareImage.path);
  await tab.screenshot({ path: out, type: 'png' });
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
}
