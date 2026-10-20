/**
 * Files music source: reads the music files (files.ts) the fetcher writes, from
 * the site's own origin, and returns them as the MusicSource types (source.ts)
 * with `mock: false`. JSON has no Date, so the ISO strings are parsed here.
 *
 * A file that cannot be read rejects. This source has no fallback and no wording:
 * what the Terminal shows for that (and for old data, by `fetchedAt`) is mvd-tt6.
 */
import { RECENT_KEY, topKey, type PlayedTrackJson, type RecentFile, type TopFile } from './files.ts';
import type { MusicSource, PlayedTrack } from './source.ts';

export interface FilesMusicOptions {
  /** Where the files are served from (default: the site's origin). */
  baseUrl?: string;
  /** The fetch to use (default: the global one), for tests. */
  fetch?: (url: string) => Promise<Response>;
}

export function createFilesMusic({ baseUrl = '/', fetch = globalThis.fetch.bind(globalThis) }: FilesMusicOptions = {}): MusicSource {
  async function read<T>(key: string): Promise<T> {
    const res = await fetch(`${baseUrl}${key}`);
    if (!res.ok) throw new Error(`${key}: ${res.status}`);
    return (await res.json()) as T;
  }

  /** The playing track has no start time in the file; its `at` is the file's `fetchedAt`. The Terminal shows no time for it. */
  const played = ({ track, playing, at }: PlayedTrackJson, file: RecentFile): PlayedTrack => ({
    track,
    playing,
    at: new Date(at ?? file.fetchedAt),
  });

  return {
    async top(kind, period) {
      const file = await read<TopFile>(topKey(kind, period));
      return { items: file.items, mock: false, fetchedAt: new Date(file.fetchedAt) };
    },
    async nowPlaying() {
      const file = await read<RecentFile>(RECENT_KEY);
      const [latest] = file.tracks;
      if (!latest) throw new Error(`${RECENT_KEY}: no tracks`);
      const { track, playing, at } = played(latest, file);
      return { track, playing, at, mock: false, fetchedAt: new Date(file.fetchedAt) };
    },
    async recent() {
      const file = await read<RecentFile>(RECENT_KEY);
      return { tracks: file.tracks.map((t) => played(t, file)), mock: false, fetchedAt: new Date(file.fetchedAt) };
    },
  };
}
