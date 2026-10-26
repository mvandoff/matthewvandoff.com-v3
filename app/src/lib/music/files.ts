/**
 * Music files: the JSON the fetcher writes to S3 and the site reads, so the
 * site never calls last.fm itself. Pure types and key helpers, with no imports,
 * so both the site and a Lambda can import this file by relative path.
 *
 * Shaped like source.ts, but JSON has no Date and no placeholder data, so
 * timestamps are ISO 8601 strings and there is no `mock` flag. Sources return
 * raw data; wording and ranking stay the Terminal command module's job.
 *
 * Files, 13 in all:
 *   music/recent.json                    recent tracks, which also covers now playing
 *   music/top-{kind}-{period}.json       e.g. music/top-artists-week.json
 */

export type TopKind = 'artists' | 'tracks' | 'albums';

/** week = 7 days, month = 30 days, year = 12 months, all = all time. */
export type Period = 'week' | 'month' | 'year' | 'all';

export interface TopItemJson {
  /** Artist, track or album name, as last.fm has it. */
  name: string;
  /** The artist, for tracks and albums. */
  artist?: string;
  /** Play count for the period. */
  plays: number;
}

export interface TopFile {
  /** When the fetcher read last.fm (ISO 8601). */
  fetchedAt: string;
  kind: TopKind;
  period: Period;
  /** Most played first. Empty for an account with no plays. */
  items: TopItemJson[];
}

/** Album art on last.fm's CDN. */
export interface ArtJson {
  /** 300px square. */
  thumb: string;
  /** The original upload, often 1000px or more. */
  full: string;
}

export interface TrackJson {
  title: string;
  artist: string;
  /** Absent when last.fm has no album for the play. */
  album?: string;
  /** Absent when last.fm has no art for the play. */
  art?: ArtJson;
}

export interface PlayedTrackJson {
  track: TrackJson;
  /** True for the track playing right now. */
  playing: boolean;
  /**
   * When it was scrobbled (ISO 8601). Null for the playing track: last.fm gives no start
   * time, and `fetchedAt` here would change the file on every fetch. What to show is the
   * reader's call.
   */
  at: string | null;
}

export interface RecentFile {
  /** When the fetcher read last.fm (ISO 8601). */
  fetchedAt: string;
  /** Newest first. The playing track, if any, is first. Empty for an account with no plays. */
  tracks: PlayedTrackJson[];
}

export const PERIODS: readonly Period[] = ['week', 'month', 'year', 'all'];
export const TOP_KINDS: readonly TopKind[] = ['artists', 'tracks', 'albums'];

/** S3 key of the recent tracks file. */
export const RECENT_KEY = 'music/recent.json';

/** S3 key of a top list file. */
export function topKey(kind: TopKind, period: Period): string {
  return `music/top-${kind}-${period}.json`;
}
