/**
 * Builds sample music files (the JSON the fetcher will write to S3) from the
 * last.fm mapping fixtures, through the real mapping functions in
 * src/lib/music/lastfm.ts, so they are exactly the real file format. Used by the
 * files-source tests, the e2e "real data" test and `astro dev` (see
 * astro.config.mjs). They are never in public/, so they never ship.
 *
 * Run `pnpm music:samples` after changing the mapping or the fixtures, then commit
 * tests/fixtures/music/ (a unit test fails when they are out of date).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PERIODS, RECENT_KEY, topKey, type Period } from '../src/lib/music/files.ts';
import { mapRecentTracks, mapTopAlbums, mapTopArtists, mapTopTracks, type LastfmPeriod } from '../src/lib/music/lastfm.ts';
import albums from '../tests/unit/fixtures/lastfm/top-albums-overall.json' with { type: 'json' };
import artists from '../tests/unit/fixtures/lastfm/top-artists-7day.json' with { type: 'json' };
import nowPlaying from '../tests/unit/fixtures/lastfm/recent-now-playing.json' with { type: 'json' };
import tracks from '../tests/unit/fixtures/lastfm/top-tracks-7day.json' with { type: 'json' };

/** Fixed, so the files only change when the mapping or fixtures do. */
export const SAMPLE_FETCHED_AT = new Date('2026-10-19T12:00:00Z');

const lastfmPeriod: Record<Period, LastfmPeriod> = { week: '7day', month: '1month', year: '12month', all: 'overall' };

/**
 * All 13 files by S3 key, music/recent.json first. There is one fixture per kind, so
 * the periods of a kind share its data; the playing track is first in recent.json.
 */
export function buildSamples(): Record<string, unknown> {
  const files: Record<string, unknown> = {
    [RECENT_KEY]: mapRecentTracks(nowPlaying, SAMPLE_FETCHED_AT, { limit: 10 }),
  };
  for (const period of PERIODS) {
    const p = lastfmPeriod[period];
    files[topKey('artists', period)] = mapTopArtists(artists, p, SAMPLE_FETCHED_AT);
    files[topKey('tracks', period)] = mapTopTracks(tracks, p, SAMPLE_FETCHED_AT);
    files[topKey('albums', period)] = mapTopAlbums(albums, p, SAMPLE_FETCHED_AT);
  }
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = fileURLToPath(new URL('../tests/fixtures/', import.meta.url));
  await mkdir(`${dir}music`, { recursive: true });
  for (const [key, file] of Object.entries(buildSamples())) {
    await writeFile(`${dir}${key}`, JSON.stringify(file, null, 2) + '\n');
    console.log(key);
  }
}
