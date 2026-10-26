/**
 * Music source: the typed interface the Terminal reads listening data through,
 * so real last.fm data can replace the mock without changing the Terminal.
 *
 * Sources return raw data (play counts, timestamps). All wording, ranking,
 * bar widths and relative times are the Terminal command module's job
 * (src/lib/terminal/commands.ts), so every source reads the same.
 *
 * last.fm mapping: `top` = user.gettopartists /
 * gettoptracks / gettopalbums with period 7day | 1month | 12month | overall;
 * `nowPlaying` and `recent` = user.getrecenttracks (its nowplaying flag).
 */

export type TopKind = 'artists' | 'tracks' | 'albums';

/** week = 7 days, month = 30 days, year = 12 months, all = all time. */
export type Period = 'week' | 'month' | 'year' | 'all';

export interface TopItem {
  /** Artist, track or album name. */
  name: string;
  /** The artist, for tracks and albums. */
  artist?: string;
  /** Play count for the period. Display rounds it (a mock may scale counts). */
  plays: number;
}

export interface TopList {
  /** Most played first. */
  items: TopItem[];
  /** True for placeholder data; drives the "· mock data" meta labels. */
  mock: boolean;
  /** When the data was read from last.fm, for how old it is (a mock reports its own time). */
  fetchedAt: Date;
}

export interface Track {
  title: string;
  artist: string;
  album?: string;
  /** Album art: a thumbnail and the full size. Absent when there is none; the Terminal then shows its kana. */
  art?: { thumb: string; full: string };
}

export interface NowPlaying {
  track: Track;
  /** True while a track is playing; false means `track` was the last one played. */
  playing: boolean;
  /** When it was last played. For a playing track last.fm gives no start time, so the Terminal shows none. */
  at: Date;
  mock: boolean;
  /** When the data was read from last.fm, for how old it is (a mock reports its own time). */
  fetchedAt: Date;
}

export interface PlayedTrack {
  track: Track;
  /** True for the track playing right now. */
  playing: boolean;
  at: Date;
}

export interface RecentTracks {
  /** Newest first. */
  tracks: PlayedTrack[];
  mock: boolean;
  /** When the data was read from last.fm, for how old it is (a mock reports its own time). */
  fetchedAt: Date;
}

export interface MusicSource {
  /** Top items of a kind over a period, most played first. */
  top(kind: TopKind, period: Period): Promise<TopList>;
  /** The now-playing track, or the last played one. */
  nowPlaying(): Promise<NowPlaying>;
  /** The most recently played tracks, newest first. */
  recent(): Promise<RecentTracks>;
}
