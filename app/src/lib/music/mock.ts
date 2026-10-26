/**
 * Mock music source reproducing the original design's placeholder data: top lists
 * with per-period scaling, the now/last-played track and the recent tracks.
 * It is frozen at "last played"; `playing: true` gives the other listening state.
 */
import type { MusicSource, Period, PlayedTrack, TopItem, TopKind } from './source.ts';

/** 12-month play counts. Other periods scale these. */
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
    ['artist.11', undefined, 72],
    ['artist.12', undefined, 66],
    ['artist.13', undefined, 59],
    ['artist.14', undefined, 53],
    ['artist.15', undefined, 48],
    ['artist.16', undefined, 44],
    ['artist.17', undefined, 40],
    ['artist.18', undefined, 36],
    ['artist.19', undefined, 33],
    ['artist.20', undefined, 30],
    ['artist.21', undefined, 27],
    ['artist.22', undefined, 25],
    ['artist.23', undefined, 22],
    ['artist.24', undefined, 20],
    ['artist.25', undefined, 18],
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
    ['track.14', 'artist.07', 19],
    ['track.06', 'artist.10', 18],
    ['track.19', 'artist.02', 16],
    ['track.01', 'artist.05', 15],
    ['track.23', 'artist.03', 14],
    ['track.08', 'artist.01', 13],
    ['track.16', 'artist.04', 12],
    ['track.10', 'artist.06', 11],
    ['track.22', 'artist.08', 10],
    ['track.04', 'artist.09', 9],
    ['track.17', 'artist.02', 9],
    ['track.13', 'artist.10', 8],
    ['track.20', 'artist.07', 7],
    ['track.24', 'artist.05', 7],
    ['track.25', 'artist.03', 6],
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
    ['album.11', 'artist.03', 38],
    ['album.12', 'artist.08', 34],
    ['album.13', 'artist.02', 31],
    ['album.14', 'artist.11', 28],
    ['album.15', 'artist.05', 25],
    ['album.16', 'artist.01', 22],
    ['album.17', 'artist.09', 20],
    ['album.18', 'artist.12', 18],
    ['album.19', 'artist.04', 16],
    ['album.20', 'artist.06', 14],
    ['album.21', 'artist.13', 13],
    ['album.22', 'artist.07', 12],
    ['album.23', 'artist.10', 10],
    ['album.24', 'artist.14', 9],
    ['album.25', 'artist.02', 8],
  ],
};

/**
 * 12-month counts scaled per period. Counts stay unrounded so the bars keep the
 * 12-month shape.
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
  ['track.14', 'artist.07'],
  ['track.06', 'artist.10'],
  ['track.19', 'artist.02'],
  ['track.01', 'artist.05'],
  ['track.23', 'artist.03'],
  ['track.08', 'artist.01'],
  ['track.16', 'artist.04'],
  ['track.10', 'artist.06'],
  ['track.22', 'artist.08'],
  ['track.04', 'artist.09'],
  ['track.17', 'artist.02'],
  ['track.13', 'artist.10'],
  ['track.20', 'artist.07'],
  ['track.24', 'artist.05'],
  ['track.25', 'artist.03'],
];

/**
 * Minutes since each recent track, chosen so they read as:
 * playing `now 4m 9m 15m 1h 1h 2h 2h 3h 5h 5h 6h 7h 7h 8h 9h 10h 11h 13h 15h 17h 20h 1d 1d 2d`,
 * last played `2h 2h 2h 3h 3h 4h 4h 5h 6h 6h 7h 7h 8h 9h 10h 11h 13h 15h 17h 20h 22h 1d 1d 2d 3d`.
 */
const recentPlaying = [
  0, 4.5, 9.5, 15.5, 70, 95, 130, 155, 200, 320, 350, 390, 450, 470, 510, 570, 630, 690, 810, 930, 1050, 1230, 1650,
  2190, 2970,
];
const recentLastPlayed = [
  130, 140, 160, 190, 215, 250, 275, 320, 380, 400, 450, 470, 510, 570, 630, 690, 810, 930, 1050, 1230, 1350, 1650,
  2190, 2970, 4350,
];

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
