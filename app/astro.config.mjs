// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Directory-style output (about/index.html), per the spec. Astro's default, kept explicit.
  build: { format: 'directory' },
});
