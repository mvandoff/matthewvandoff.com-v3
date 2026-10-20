/**
 * Mock music source reproducing the design's placeholder data exactly (the board
 * script in design/reference/warm-terminal.html, `termExec`): top lists with the
 * board's per-period scaling, the now/last-played track and the recent tracks.
 * The site ships it frozen at "last played", per the spec; `playing: true` gives
 * the board's other listening state.
 */
import type { MusicSource, Period, PlayedTrack, TopItem, TopKind } from './source.ts';

/** 12-month play counts. Other periods scale these (the board's per-period factors). */
const top12: Record<TopKind, Array<[string, string | undefined, number]>> = {
  artists: [
    ['artist.01', undefined, 412],
    ['artist.02', undefined, 356],
    ['artist.03', undefined, 298],
    ['artist.04', undefined, 241],
    ['artist.05', undefined, 187],
    ['artist.06', undefined, 164],
    ['artist.07', undefined, 139],
    ['artist.08', undefined, 118],
    ['artist.09', undefined, 96],
    ['artist.10', undefined, 81],
  ],
  tracks: [
    ['track.07', 'artist.02', 64],
    ['track.12', 'artist.01', 58],
    ['track.03', 'artist.05', 51],
    ['track.21', 'artist.02', 44],
    ['track.09', 'artist.04', 39],
    ['track.15', 'artist.06', 35],
    ['track.02', 'artist.01', 31],
    ['track.18', 'artist.08', 28],
    ['track.11', 'artist.03', 24],
    ['track.05', 'artist.09', 21],
  ],
  albums: [
    ['album.02', 'artist.01', 188],
    ['album.05', 'artist.02', 171],
    ['album.01', 'artist.03', 140],
    ['album.04', 'artist.02', 122],
    ['album.03', 'artist.05', 97],
    ['album.06', 'artist.07', 84],
    ['album.09', 'artist.04', 72],
    ['album.07', 'artist.01', 61],
    ['album.08', 'artist.10', 50],
    ['album.10', 'artist.06', 43],
  ],
};

/**
 * The board scales 12-month counts per period. Counts stay unrounded so the
 * bars keep the 12-month shape, exactly as on the board.
 */
const scale: Record<Period, number> = { week: 0.04, month: 0.14, year: 1, all: 3.6 };

const recentTracks: Array<[string, string]> = [
  ['track.07', 'artist.02'],
  ['track.12', 'artist.01'],
  ['track.03', 'artist.05'],
  ['track.21', 'artist.02'],
  ['track.09', 'artist.04'],
  ['track.15', 'artist.06'],
  ['track.02', 'artist.01'],
  ['track.18', 'artist.08'],
  ['track.11', 'artist.03'],
  ['track.05', 'artist.09'],
];

/**
 * Minutes since each recent track, chosen so they read as the board's times:
 * playing `now 4m 9m 15m 1h 1h 2h 2h 3h 5h`, last played `2h 2h 2h 3h 3h 4h 4h 5h 6h 6h`.
 */
const recentPlaying = [0, 4.5, 9.5, 15.5, 70, 95, 130, 155, 200, 320];
const recentLastPlayed = [130, 140, 160, 190, 215, 250, 275, 320, 380, 400];

/** A moment `minutes` before `now`. Mock offsets sit mid-unit so they read stably. */
const minutesAgo = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000);

export interface MockOptions {
  /** The clock the relative times are measured from. */
  now?: () => Date;
  /** The listening state: playing, or (default) last played. */
  playing?: boolean;
}

export function createMockMusic({ now = () => new Date(), playing = false }: MockOptions = {}): MusicSource {
  return {
    async top(kind, period) {
      const items = top12[kind].map(([name, artist, plays]): TopItem => {
        const item: TopItem = { name, plays: plays * scale[period] };
        if (artist) item.artist = artist;
        return item;
      });
      return { items, mock: true, fetchedAt: now() };
    },
    async nowPlaying() {
      return {
        track: { title: '[track title]', artist: '[artist]', album: '[album]' },
        playing,
        at: minutesAgo(now(), playing ? 2.5 : 130),
        mock: true,
        fetchedAt: now(),
      };
    },
    async recent() {
      const offsets = playing ? recentPlaying : recentLastPlayed;
      const tracks = recentTracks.map(
        ([title, artist], i): PlayedTrack => ({
          track: { title, artist },
          playing: playing && i === 0,
          at: minutesAgo(now(), offsets[i]!),
        }),
      );
      return { tracks, mock: true, fetchedAt: now() };
    },
  };
}
