/**
 * Cloudflare Web Analytics: a cookieless beacon, so no consent banner (mvd-26r).
 *
 * The site token comes from the Cloudflare dashboard: Analytics & Logs → Web Analytics →
 * the site → Manage site, the `token` in the JS snippet. It is public (it ships in the
 * page), so it lives here rather than in an environment variable. While it is empty the
 * page has no beacon script at all.
 */
export const cloudflareAnalyticsToken: string = '';

/** The beacon script's URL. */
export const cloudflareBeaconSrc = 'https://static.cloudflareinsights.com/beacon.min.js';
