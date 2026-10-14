/**
 * Music source: the typed interface the Terminal reads listening data through,
 * so real last.fm data can replace the mock without changing the Terminal.
 *
 * mvd-034.4 owns this module: it adds the top-items and recent-tracks queries
 * and completes the mock. Only the idle status's last-played line exists so far.
 */

export interface Track {
  title: string;
  artist: string;
}

export interface NowPlaying {
  track: Track;
  /** True while a track is playing; false means `track` was the last one played. */
  playing: boolean;
  /** Relative time, e.g. "2h ago". */
  ago: string;
  /** True for placeholder data; drives the "· mock data" meta labels. */
  mock: boolean;
}

export interface MusicSource {
  /** The now-playing track, or the last played one. */
  nowPlaying(): Promise<NowPlaying>;
}
