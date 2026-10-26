/**
 * robots.txt: everything may be crawled; points at the sitemap. The origin comes
 * from `site` in astro.config.mjs.
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) =>
  new Response(['User-agent: *', 'Allow: /', '', `Sitemap: ${new URL('/sitemap.xml', site)}`, ''].join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
