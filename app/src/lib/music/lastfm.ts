/**
 * last.fm mapping: pure functions from last.fm API responses to the music
 * files in files.ts. No I/O and no imports beyond files.ts, so the site and a
 * Lambda can both bundle it by relative path.
 */

import type { PlayedTrackJson, Period, RecentFile, TopFile, TopItemJson } from './files.ts';

/** The `period` parameter of user.gettop*. */
export type LastfmPeriod = '7day' | '1month' | '12month' | 'overall';

/** last.fm's JSON sends one item as a bare object, and may leave the field out when there are none. */
type OneOrMany<T> = T | T[];

function toArray<T>(list: OneOrMany<T> | undefined): T[] {
  if (list === undefined) return [];
  return Array.isArray(list) ? list : [list];
}

/** user.gettopartists (fields we read; last.fm sends numbers as strings). */
export interface LastfmTopArtists {
  topartists: { artist?: OneOrMany<{ name: string; playcount: string }> };
}

/** user.gettoptracks. */
export interface LastfmTopTracks {
  toptracks: { track?: OneOrMany<{ name: string; playcount: string; artist: { name: string } }> };
}

/** user.gettopalbums. */
export interface LastfmTopAlbums {
  topalbums: { album?: OneOrMany<{ name: string; playcount: string; artist: { name: string } }> };
}

/** user.getrecenttracks. The playing track has `@attr.nowplaying` and no `date`. */
export interface LastfmRecentTracks {
  recenttracks: {
    track?: OneOrMany<{
      name: string;
      artist: { '#text': string };
      album: { '#text': string };
      date?: { uts: string };
      '@attr'?: { nowplaying: string };
    }>;
  };
}

const PERIODS: Record<LastfmPeriod, Period> = {
  '7day': 'week',
  '1month': 'month',
  '12month': 'year',
  overall: 'all',
};

/** user.gettopartists to a top artists file. */
export function mapTopArtists(res: LastfmTopArtists, period: LastfmPeriod, fetchedAt: Date): TopFile {
  const items: TopItemJson[] = toArray(res.topartists.artist).map((a) => ({ name: a.name, plays: Number(a.playcount) }));
  return { fetchedAt: fetchedAt.toISOString(), kind: 'artists', period: PERIODS[period], items };
}

/** user.gettoptracks to a top tracks file. */
export function mapTopTracks(res: LastfmTopTracks, period: LastfmPeriod, fetchedAt: Date): TopFile {
  const items: TopItemJson[] = toArray(res.toptracks.track).map((t) => ({
    name: t.name,
    artist: t.artist.name,
    plays: Number(t.playcount),
  }));
  return { fetchedAt: fetchedAt.toISOString(), kind: 'tracks', period: PERIODS[period], items };
}

/** user.gettopalbums to a top albums file. */
export function mapTopAlbums(res: LastfmTopAlbums, period: LastfmPeriod, fetchedAt: Date): TopFile {
  const items: TopItemJson[] = toArray(res.topalbums.album).map((a) => ({
    name: a.name,
    artist: a.artist.name,
    plays: Number(a.playcount),
  }));
  return { fetchedAt: fetchedAt.toISOString(), kind: 'albums', period: PERIODS[period], items };
}

/** last.fm sometimes records one scrobble twice, a few seconds apart; a real replay is minutes apart. */
const DUPLICATE_WINDOW_MS = 30_000;

/** Whether `play` repeats a play in `kept`, the newer plays already kept. The playing track is never a duplicate. */
function isDuplicate(play: PlayedTrackJson, kept: PlayedTrackJson[]): boolean {
  if (play.at === null) return false;
  // `kept` is newest first, so the last match is the kept play of this track nearest in time to `play`.
  const same = kept.findLast(
    (k) => k.at !== null && k.track.title === play.track.title && k.track.artist === play.track.artist,
  );
  return same !== undefined && Date.parse(same.at!) - Date.parse(play.at) <= DUPLICATE_WINDOW_MS;
}

/** user.getrecenttracks to the recent tracks file. */
export function mapRecentTracks(res: LastfmRecentTracks, fetchedAt: Date, options: { limit: number }): RecentFile {
  const mapped: PlayedTrackJson[] = toArray(res.recenttracks.track).map((t) => ({
    track: {
      title: t.name,
      artist: t.artist['#text'],
      // last.fm sends an empty album as "#text": "".
      ...(t.album['#text'] && { album: t.album['#text'] }),
    },
    playing: t['@attr']?.nowplaying === 'true',
    // The playing track has no date, and a fetch time here would change the file on every fetch.
    at: t.date ? new Date(Number(t.date.uts) * 1000).toISOString() : null,
  }));
  const tracks: PlayedTrackJson[] = [];
  for (const play of mapped) if (!isDuplicate(play, tracks)) tracks.push(play);
  return { fetchedAt: fetchedAt.toISOString(), tracks: tracks.slice(0, options.limit) };
}
