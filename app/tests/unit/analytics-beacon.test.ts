import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, test } from 'vitest';
import AnalyticsBeacon from '../../src/components/AnalyticsBeacon.astro';

async function render(token: string): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(AnalyticsBeacon, { props: { token } });
}

/** The attributes of the one <script> tag in `html`, decoded. */
function scriptAttributes(html: string): Record<string, string> {
  const tags = html.match(/<script\b[^>]*>/g) ?? [];
  expect(tags).toHaveLength(1);
  const attributes: Record<string, string> = {};
  for (const [, name, value] of tags[0]!.matchAll(/\s([\w-]+)(?:="([^"]*)")?/g)) {
    attributes[name!] = (value ?? '').replace(/&quot;/g, '"').replace(/&#34;/g, '"').replace(/&amp;/g, '&');
  }
  return attributes;
}

describe('the Cloudflare Web Analytics beacon', () => {
  test('renders nothing while the token is empty', async () => {
    expect((await render('')).trim()).toBe('');
  });

  test('renders the standard deferred beacon when the token is set', async () => {
    const attributes = scriptAttributes(await render('abc123'));
    expect(attributes['src']).toBe('https://static.cloudflareinsights.com/beacon.min.js');
    expect(attributes).toHaveProperty('defer');
    expect(JSON.parse(attributes['data-cf-beacon']!)).toEqual({ token: 'abc123' });
  });
});
