import { describe, expect, it } from 'vitest';
import { createMockMusic } from '../../src/lib/music/mock.ts';
import type { MusicSource, Period, TopKind } from '../../src/lib/music/source.ts';
import { execute, listening, type Line, type Row, type TerminalContext } from '../../src/lib/terminal/commands.ts';
import { noAccent } from '../helpers/context.ts';

const NOW = new Date(2026, 9, 14, 9, 30, 5);
const now = () => NOW;

/** The Terminal as the site ships it: the mock source, frozen at "last played". */
const ctx: TerminalContext = { now, music: createMockMusic({ now }), accent: noAccent };

/** A line as `[text, tone]` pairs, tone '' when unstyled. */
const pairs = (line: Line) => line.map((span) => [span.text, span.tone ?? '']);

/** Rows as `[rank, name, pct, count]`. */
const table = (rows: Row[] | undefined) => rows?.map((r) => [r.rank, r.name, r.pct, r.count]);

describe('top', () => {
  it('defaults to the top 10 artists over 12 months, as ranked bar rows', async () => {
    const result = await execute('top', ctx);
    expect(table(result.output?.rows)).toEqual([
      ['01', 'artist.01', 100, '412'],
      ['02', 'artist.02', 86, '356'],
      ['03', 'artist.03', 72, '298'],
      ['04', 'artist.04', 58, '241'],
      ['05', 'artist.05', 45, '187'],
      ['06', 'artist.06', 40, '164'],
      ['07', 'artist.07', 34, '139'],
      ['08', 'artist.08', 29, '118'],
      ['09', 'artist.09', 23, '96'],
      ['10', 'artist.10', 20, '81'],
    ]);
    expect(result.output?.lines).toEqual([]);
    expect(result.meta).toBe('top artists · 12 months · mock data');
    expect(result.large).toBe(true);
    expect(result.echo).toBe('top');
    expect(result.effects).toEqual([]);
  });

  // Names, bar widths and counts as the board renders them for each kind and
  // period (design/reference/warm-terminal.html, termExec). Bars keep the
  // 12-month shape; counts are scaled per period, rounded, at least 1.
  const names = {
    artists: ['artist.01', 'artist.02', 'artist.03', 'artist.04', 'artist.05', 'artist.06', 'artist.07', 'artist.08', 'artist.09', 'artist.10'],
    tracks: ['track.07 — artist.02', 'track.12 — artist.01', 'track.03 — artist.05', 'track.21 — artist.02', 'track.09 — artist.04', 'track.15 — artist.06', 'track.02 — artist.01', 'track.18 — artist.08', 'track.11 — artist.03', 'track.05 — artist.09'],
    albums: ['album.02 — artist.01', 'album.05 — artist.02', 'album.01 — artist.03', 'album.04 — artist.02', 'album.03 — artist.05', 'album.06 — artist.07', 'album.09 — artist.04', 'album.07 — artist.01', 'album.08 — artist.10', 'album.10 — artist.06'],
  };
  const bars = {
    artists: [100, 86, 72, 58, 45, 40, 34, 29, 23, 20],
    tracks: [100, 91, 80, 69, 61, 55, 48, 44, 38, 33],
    albums: [100, 91, 74, 65, 52, 45, 38, 32, 27, 23],
  };
  const combos = [
    ['artists', '--week', '7 days', '16 14 12 10 7 7 6 5 4 3'],
    ['artists', '--month', '30 days', '58 50 42 34 26 23 19 17 13 11'],
    ['artists', '--year', '12 months', '412 356 298 241 187 164 139 118 96 81'],
    ['artists', '--all', 'all time', '1483 1282 1073 868 673 590 500 425 346 292'],
    ['tracks', '--week', '7 days', '3 2 2 2 2 1 1 1 1 1'],
    ['tracks', '--month', '30 days', '9 8 7 6 5 5 4 4 3 3'],
    ['tracks', '--year', '12 months', '64 58 51 44 39 35 31 28 24 21'],
    ['tracks', '--all', 'all time', '230 209 184 158 140 126 112 101 86 76'],
    ['albums', '--week', '7 days', '8 7 6 5 4 3 3 2 2 2'],
    ['albums', '--month', '30 days', '26 24 20 17 14 12 10 9 7 6'],
    ['albums', '--year', '12 months', '188 171 140 122 97 84 72 61 50 43'],
    ['albums', '--all', 'all time', '677 616 504 439 349 302 259 220 180 155'],
  ] as const;

  it.each(combos)('top %s %s: ranked rows and the meta line', async (kind, flag, label, counts) => {
    const result = await execute(`top ${kind} ${flag}`, ctx);
    const ranks = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
    expect(table(result.output?.rows)).toEqual(
      counts.split(' ').map((count, i) => [ranks[i], names[kind][i], bars[kind][i], count]),
    );
    expect(result.meta).toBe(`top ${kind} · ${label} · mock data`);
    expect(result.large).toBe(true);
    expect(result.echo).toBe(`top ${kind} ${flag}`);
  });

  it('defaults the kind to artists and the period to 12 months, so --year equals the default', async () => {
    const plain = await execute('top', ctx);
    for (const input of ['top artists', 'top --year', 'top artists --year']) {
      const result = await execute(input, ctx);
      expect(result.output).toEqual(plain.output);
      expect(result.meta).toBe(plain.meta);
    }
    expect((await execute('top --week', ctx)).meta).toBe('top artists · 7 days · mock data');
    expect((await execute('top albums', ctx)).meta).toBe('top albums · 12 months · mock data');
  });

  it('takes its words in any order and any case, ignoring the rest, as the board does', async () => {
    expect((await execute('TOP --All Tracks', ctx)).meta).toBe('top tracks · all time · mock data');
    expect((await execute('top --month nonsense albums', ctx)).meta).toBe('top albums · 30 days · mock data');
    // Several kinds or periods: tracks beat albums beat artists; --week beats --month beats --all.
    expect((await execute('top albums tracks artists', ctx)).meta).toBe('top tracks · 12 months · mock data');
    expect((await execute('top --all --month --week', ctx)).meta).toBe('top artists · 7 days · mock data');
    expect((await execute('top --all --month', ctx)).meta).toBe('top artists · 30 days · mock data');
  });
});

describe('np', () => {
  it('shows the last played track when nothing is playing', async () => {
    const result = await execute('np', ctx);
    expect(result.output?.lines.map(pairs)).toEqual([
      [['■ ', 'dim'], ['[track title] — [artist]', '']],
      [['  2h ago', 'dim']],
    ]);
    expect(result.output?.rows).toEqual([]);
    expect(result.meta).toBe('last.fm · mock data');
    expect(result.large).toBe(true);
    expect(result.echo).toBe('np');
  });

  it('shows the playing track as now playing, with no album or time', async () => {
    const playing = { now, music: createMockMusic({ now, playing: true }), accent: noAccent };
    const result = await execute('NP', playing);
    expect(result.output?.lines.map(pairs)).toEqual([
      [['▶ ', 'acc'], ['[track title] — [artist]', '']],
      [['  now playing', 'dim']],
    ]);
    expect(result.meta).toBe('last.fm · mock data');
    expect(result.large).toBe(true);
  });
});

describe('recent', () => {
  const tracks = [
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

  it('lists the last 10 tracks with relative times, the artist in the second colour', async () => {
    const result = await execute('recent', ctx);
    const times = ['2h   ', '2h   ', '2h   ', '3h   ', '3h   ', '4h   ', '4h   ', '5h   ', '6h   ', '6h   '];
    expect(result.output?.lines.map(pairs)).toEqual(
      tracks.map(([track, artist], i) => [[times[i], 'dim'], [`${track} — `, ''], [artist, 'tl']]),
    );
    expect(result.output?.rows).toEqual([]);
    expect(result.meta).toBe('last.fm · mock data');
    expect(result.large).toBe(true);
    expect(result.echo).toBe('recent');
  });

  it('marks the playing track "now" in the Accent', async () => {
    const playing = { now, music: createMockMusic({ now, playing: true }), accent: noAccent };
    const result = await execute('recent', playing);
    const times = ['now  ', '4m   ', '9m   ', '15m  ', '1h   ', '1h   ', '2h   ', '2h   ', '3h   ', '5h   '];
    expect(result.output?.lines.map(pairs)).toEqual(
      tracks.map(([track, artist], i) => [[times[i], i ? 'dim' : 'acc'], [`${track} — `, ''], [artist, 'tl']]),
    );
  });
});

describe('idle listening line', () => {
  it('names the last played track with " · 2h ago" and no EQ', async () => {
    expect(await listening(ctx)).toEqual({ track: '[track title] — [artist]', ago: ' · 2h ago', eq: false });
  });

  it('shows the EQ and no time while a track plays', async () => {
    const playing = { now, music: createMockMusic({ now, playing: true }), accent: noAccent };
    expect(await listening(playing)).toEqual({ track: '[track title] — [artist]', ago: '', eq: true });
  });
});

describe('another music source (e.g. real last.fm)', () => {
  const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);
  const asked: Array<[TopKind, Period]> = [];
  const lastfm: MusicSource = {
    async top(kind, period) {
      asked.push([kind, period]);
      return {
        items: [
          { name: 'Weightless', artist: 'Marconi Union', plays: 200 },
          { name: 'Svefn-g-englar', artist: 'Sigur Rós', plays: 50 },
          { name: 'Avril 14th', artist: 'Aphex Twin', plays: 3 },
        ],
        mock: false,
        fetchedAt: NOW,
      };
    },
    async nowPlaying() {
      return { track: { title: 'Teardrop', artist: 'Massive Attack' }, playing: true, at: minutesAgo(1), mock: false, fetchedAt: NOW };
    },
    async recent() {
      return {
        tracks: Array.from({ length: 12 }, (_, i) => ({
          track: { title: `Song ${i + 1}`, artist: `Band ${i + 1}` },
          playing: false,
          at: minutesAgo([0, 59, 60, 1439, 1440, 4400][i] ?? 9000),
        })),
        mock: false,
        fetchedAt: NOW,
      };
    },
  };
  const real: TerminalContext = { now, music: lastfm, accent: noAccent };

  it('asks it for the kind and period typed, and draws bars from its counts without the mock label', async () => {
    const result = await execute('top tracks --week', real);
    expect(asked).toEqual([['tracks', 'week']]);
    expect(table(result.output?.rows)).toEqual([
      ['01', 'Weightless — Marconi Union', 100, '200'],
      ['02', 'Svefn-g-englar — Sigur Rós', 25, '50'],
      ['03', 'Avril 14th — Aphex Twin', 4, '3'],
    ]);
    expect(result.meta).toBe('top tracks · 7 days');
  });

  it('shows its now playing track', async () => {
    const result = await execute('np', real);
    expect(result.output?.lines.map(pairs)).toEqual([
      [['▶ ', 'acc'], ['Teardrop — Massive Attack', '']],
      [['  now playing', 'dim']],
    ]);
    expect(result.meta).toBe('last.fm');
  });

  it('shows only its 10 newest tracks, in minutes, hours, then days', async () => {
    const result = await execute('recent', real);
    expect(result.output?.lines.map((l) => l[0]!.text)).toEqual([
      '0m   ', '59m  ', '1h   ', '23h  ', '1d   ', '3d   ', '6d   ', '6d   ', '6d   ', '6d   ',
    ]);
    expect(result.meta).toBe('last.fm');
  });
});

describe('music data that cannot be loaded (a missing file, a failed fetch, no tracks)', () => {
  const failed = new Error('music/recent.json: 404');
  const broken: TerminalContext = {
    now,
    music: {
      top: () => Promise.reject(failed),
      nowPlaying: () => Promise.reject(failed),
      recent: () => Promise.reject(failed),
    },
    accent: noAccent,
  };

  it.each(['top', 'top tracks --week', 'np', 'recent'])('%s says so, inside the Terminal', async (input) => {
    const name = input.split(' ')[0];
    const result = await execute(input, broken);
    expect(result.output?.lines.map(pairs)).toEqual([
      [[`${name}: couldn't load music data`, 'dim'], ['  · try again later', 'dim']],
    ]);
    expect(result.output?.rows).toEqual([]);
    expect(result.meta).toBeUndefined();
    expect(result.large).toBe(false);
    expect(result.echo).toBe(input);
  });

  it('recent with no tracks says the same', async () => {
    const empty: TerminalContext = {
      ...broken,
      music: { ...broken.music, recent: async () => ({ tracks: [], mock: false, fetchedAt: NOW }) },
    };
    expect((await execute('recent', empty)).output?.lines.map(pairs)).toEqual([
      [["recent: couldn't load music data", 'dim'], ['  · try again later', 'dim']],
    ]);
  });
});

describe('top with nothing played in the period', () => {
  const quiet: TerminalContext = {
    now,
    music: { ...createMockMusic({ now }), top: async () => ({ items: [], mock: false, fetchedAt: NOW }) },
    accent: noAccent,
  };

  it.each([
    ['top --week', 'nothing played in the last 7 days', '  · try --month', 'top artists · 7 days'],
    ['top tracks --month', 'nothing played in the last 30 days', '  · try --year', 'top tracks · 30 days'],
    ['top albums', 'nothing played in the last 12 months', '  · try --all', 'top albums · 12 months'],
  ])('%s says so and suggests a longer period', async (input, text, hint, meta) => {
    const result = await execute(input, quiet);
    expect(result.output?.lines.map(pairs)).toEqual([[[text, 'dim'], [hint, 'dim']]]);
    expect(result.output?.rows).toEqual([]);
    expect(result.meta).toBe(meta);
    expect(result.large).toBe(false);
  });

  it('top --all says nothing has been played yet', async () => {
    const result = await execute('top --all', quiet);
    expect(result.output?.lines.map(pairs)).toEqual([[['nothing played yet', 'dim']]]);
    expect(result.meta).toBe('top artists · all time');
  });
});
