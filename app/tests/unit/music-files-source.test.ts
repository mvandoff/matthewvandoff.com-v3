import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RECENT_KEY, topKey } from '../../src/lib/music/files.ts';
import { createFilesMusic } from '../../src/lib/music/files-source.ts';
import { createMockMusic } from '../../src/lib/music/mock.ts';
import { execute, type TerminalContext } from '../../src/lib/terminal/commands.ts';
import { buildSamples } from '../../scripts/music-samples.ts';
import { noAccent } from '../helpers/context.ts';

const samples = buildSamples();
const FETCHED_AT = new Date('2026-10-19T12:00:00Z');

/** A fetch that serves the sample files by path and records what was asked for. */
function serve(overrides: Record<string, Response> = {}) {
  const asked: string[] = [];
  const fetch = async (url: string | URL | Request) => {
    const path = String(url);
    asked.push(path);
    const override = overrides[path];
    if (override) return override;
    const file = samples[path.replace(/^\//, '')];
    return file === undefined ? new Response('not found', { status: 404 }) : Response.json(file);
  };
  return { fetch, asked };
}

describe('the committed sample files', () => {
  it('are what the mapping makes from the fixtures (run `pnpm music:samples` if not)', () => {
    for (const [key, file] of Object.entries(samples)) {
      const committed = JSON.parse(readFileSync(new URL(`../fixtures/${key}`, import.meta.url), 'utf8'));
      expect(committed, key).toEqual(file);
    }
  });
});

describe('the files music source', () => {
  it('reads a top list from the same origin at the path files.ts defines, with mock: false', async () => {
    const { fetch, asked } = serve();
    const list = await createFilesMusic({ fetch }).top('tracks', 'week');
    expect(asked).toEqual(['/' + topKey('tracks', 'week')]);
    expect(list.mock).toBe(false);
    expect(list.fetchedAt).toEqual(FETCHED_AT);
    expect(list.items).toHaveLength(3);
    expect(list.items[0]).toEqual({ name: 'What You Are', artist: 'Audioslave', plays: 3 });
  });

  it('leaves artist off the items that have none', async () => {
    const list = await createFilesMusic({ fetch: serve().fetch }).top('artists', 'year');
    expect(list.items[0]).not.toHaveProperty('artist');
  });

  it('reads recent tracks as Dates, giving the playing track the file fetchedAt', async () => {
    const { fetch, asked } = serve();
    const recent = await createFilesMusic({ fetch }).recent();
    expect(asked).toEqual(['/' + RECENT_KEY]);
    expect(recent.mock).toBe(false);
    expect(recent.fetchedAt).toEqual(FETCHED_AT);
    expect(recent.tracks[0]).toMatchObject({ playing: true, at: FETCHED_AT });
    expect(recent.tracks[1]).toMatchObject({ playing: false, at: new Date('2026-10-13T21:21:13Z') });
  });

  it('reports the first recent track as now playing, or last played when nothing is playing', async () => {
    const playing = await createFilesMusic({ fetch: serve().fetch }).nowPlaying();
    expect(playing).toMatchObject({ playing: true, at: FETCHED_AT, mock: false, fetchedAt: FETCHED_AT });
    expect(playing.track).toEqual({ title: 'Spoonman', artist: 'Soundgarden', album: 'Superunknown (20th Anniversary)' });

    const idle = { fetchedAt: FETCHED_AT.toISOString(), tracks: [{ track: { title: 'T', artist: 'A' }, playing: false, at: '2026-10-19T10:00:00.000Z' }] };
    const last = await createFilesMusic({ fetch: serve({ ['/' + RECENT_KEY]: Response.json(idle) }).fetch }).nowPlaying();
    expect(last).toMatchObject({ playing: false, at: new Date('2026-10-19T10:00:00Z') });
    expect(last.track).toEqual({ title: 'T', artist: 'A' });
  });

  it('rejects when a file is missing, rather than falling back to anything', async () => {
    const missing = serve({ ['/' + topKey('albums', 'all')]: new Response('', { status: 404 }) });
    await expect(createFilesMusic({ fetch: missing.fetch }).top('albums', 'all')).rejects.toThrow('404');
  });

  it('rejects when there is nothing to report as now playing', async () => {
    const empty = { fetchedAt: FETCHED_AT.toISOString(), tracks: [] };
    const withEmpty = () => createFilesMusic({ fetch: serve({ ['/' + RECENT_KEY]: Response.json(empty) }).fetch });
    await expect(withEmpty().nowPlaying()).rejects.toThrow();
    expect((await withEmpty().recent()).tracks).toEqual([]);
  });

  it('drops the "· mock data" labels from the Terminal, which the mock source keeps', async () => {
    const now = () => new Date('2026-10-19T12:05:00Z');
    const real: TerminalContext = { now, music: createFilesMusic({ fetch: serve().fetch }), accent: noAccent };
    const mock: TerminalContext = { now, music: createMockMusic({ now }), accent: noAccent };
    for (const command of ['top artists --week', 'np', 'recent']) {
      expect((await execute(command, real)).meta, command).not.toContain('mock data');
      expect((await execute(command, mock)).meta, command).toContain('mock data');
    }
  });

  it('shows the playing track as now playing', async () => {
    const now = () => FETCHED_AT;
    const result = await execute('np', { now, music: createFilesMusic({ fetch: serve().fetch }), accent: noAccent });
    expect(result.output?.lines.map((l) => l.map((s) => s.text).join(''))).toEqual([
      '▶ Spoonman — Soundgarden',
      '  now playing',
    ]);
  });

  it('the mock reports its own time as fetchedAt', async () => {
    const now = new Date('2026-10-19T12:00:00Z');
    const music = createMockMusic({ now: () => now });
    expect((await music.top('artists', 'week')).fetchedAt).toEqual(now);
    expect((await music.nowPlaying()).fetchedAt).toEqual(now);
    expect((await music.recent()).fetchedAt).toEqual(now);
  });
});
