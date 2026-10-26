/**
 * sitemap.xml, written by hand: the site has one indexable page (the 404 page is
 * noindex). Add a path here when a page is added. The origin comes from `site` in
 * astro.config.mjs.
 */
import type { APIRoute } from 'astro';

const paths = ['/'];

export const GET: APIRoute = ({ site }) => {
  const urls = paths.map((path) => `  <url><loc>${new URL(path, site)}</loc></url>`);
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
