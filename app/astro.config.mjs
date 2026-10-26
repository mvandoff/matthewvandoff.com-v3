// @ts-check
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

/**
 * `PUBLIC_MUSIC_SOURCE=files astro dev` serves the sample music files (built from the
 * last.fm fixtures by `pnpm music:samples`) at /music/. Dev server only: they are not in
 * public/, so no build or preview contains them. See src/lib/music/index.ts.
 *
 * @type {import('astro').AstroIntegration}
 */
const devMusicFiles = {
  name: 'dev-music-files',
  hooks: {
    'astro:server:setup': ({ server }) => {
      if (process.env['PUBLIC_MUSIC_SOURCE'] !== 'files') return;
      server.middlewares.use('/music', async (req, res, next) => {
        const name = /^\/([\w-]+\.json)$/.exec(req.url ?? '')?.[1];
        if (!name) return next();
        try {
          const body = await readFile(fileURLToPath(new URL(`./tests/fixtures/music/${name}`, import.meta.url)));
          res.setHeader('Content-Type', 'application/json');
          res.end(body);
        } catch {
          next();
        }
      });
    },
  },
};

export default defineConfig({
  // Directory-style output (about/index.html). Astro's default, kept explicit.
  build: { format: 'directory' },
  // The e2e run builds twice (mock source, files source; playwright.config.ts), each to its own folder.
  outDir: process.env['ASTRO_OUT_DIR'] ?? 'dist',
  integrations: [devMusicFiles],
});
