import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { GetParameterCommand } from '@aws-sdk/client-ssm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHandler } from '../../../fetcher/handler.ts';
import { RECENT_KEY } from '../../../src/lib/music/files.ts';
import recentEmpty from '../fixtures/lastfm/recent-empty.json';
import recentNowPlaying from '../fixtures/lastfm/recent-now-playing.json';
import topAlbumsEmpty from '../fixtures/lastfm/top-albums-empty.json';
import topArtistsWeek from '../fixtures/lastfm/top-artists-7day.json';
import topArtistsEmpty from '../fixtures/lastfm/top-artists-empty.json';
import topTracksEmpty from '../fixtures/lastfm/top-tracks-empty.json';

const API_KEY = 'secret-api-key-0123456789abcdef';
const USERNAME = 'someuser';
const env = { BUCKET: 'test-bucket', API_KEY_PARAM: '/mvd/lastfm/api-key', USERNAME_PARAM: '/mvd/lastfm/username' };
const params: Record<string, string> = { [env.API_KEY_PARAM]: API_KEY, [env.USERNAME_PARAM]: USERNAME };

/** An S3 client double: objects by key, every command recorded, and failures that can be switched on. */
function fakeS3(objects: Record<string, string> = {}) {
  const fake = {
    objects,
    gets: [] as string[],
    puts: [] as PutObjectCommand['input'][],
    getError: undefined as Error | undefined,
    putError: undefined as ((key: string) => Error | undefined) | undefined,
    async send(command: unknown): Promise<unknown> {
      if (command instanceof GetObjectCommand) {
        const key = command.input.Key!;
        fake.gets.push(key);
        if (fake.getError) throw fake.getError;
        if (!(key in fake.objects)) throw Object.assign(new Error('The specified key does not exist.'), { name: 'NoSuchKey' });
        return { Body: { transformToString: async () => fake.objects[key] } };
      }
      if (command instanceof PutObjectCommand) {
        const error = fake.putError?.(command.input.Key!);
        if (error) throw error;
        fake.puts.push(command.input);
        fake.objects[command.input.Key!] = String(command.input.Body);
        return {};
      }
      throw new Error('unexpected S3 command');
    },
  };
  return fake;
}

/** An SSM client double that serves `params` and records every GetParameter call. */
function fakeSsm() {
  const fake = {
    calls: [] as GetParameterCommand['input'][],
    error: undefined as Error | undefined,
    async send(command: unknown): Promise<unknown> {
      if (!(command instanceof GetParameterCommand)) throw new Error('unexpected SSM command');
      fake.calls.push(command.input);
      if (fake.error) throw fake.error;
      return { Parameter: { Value: params[command.input.Name!] } };
    },
  };
  return fake;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

type Answer = (url: URL) => Response | Promise<Response>;

/** A last.fm fetch double that answers by `method`. Answers are functions so every call gets a fresh body. */
function lastfmFetch(answers: Record<string, Answer>) {
  return vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    const url = new URL(String(input));
    const answer = answers[url.searchParams.get('method')!];
    if (!answer) throw new Error(`unexpected method ${url.searchParams.get('method')}`);
    return answer(url);
  });
}

/** Answers for all four methods, as an account with no plays. */
function emptyAccount(overrides: Record<string, Answer> = {}): Record<string, Answer> {
  return {
    'user.getrecenttracks': () => jsonResponse(recentEmpty),
    'user.gettopartists': () => jsonResponse(topArtistsEmpty),
    'user.gettoptracks': () => jsonResponse(topTracksEmpty),
    'user.gettopalbums': () => jsonResponse(topAlbumsEmpty),
    ...overrides,
  };
}

const now = () => new Date('2026-10-19T12:00:00Z');

function setup(
  fetch: ReturnType<typeof lastfmFetch>,
  options: { s3?: ReturnType<typeof fakeS3>; ssm?: ReturnType<typeof fakeSsm>; now?: () => Date } = {},
) {
  const s3 = options.s3 ?? fakeS3();
  const ssm = options.ssm ?? fakeSsm();
  const handler = createHandler({ s3, ssm, fetch, now: options.now ?? now, env });
  return { handler, s3, ssm, fetch };
}

/** Everything the handler logged, as one string. */
function logged(spies: ReturnType<typeof vi.spyOn>[]): string {
  return spies.map((spy) => JSON.stringify(spy.mock.calls)).join('\n');
}

function silenceLogs() {
  return (['log', 'info', 'warn', 'error'] as const).map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
}

afterEach(() => vi.restoreAllMocks());

describe('recent mode', () => {
  it('writes music/recent.json with the mapped tracks and cache headers', async () => {
    const { handler, s3, fetch } = setup(lastfmFetch({ 'user.getrecenttracks': () => jsonResponse(recentNowPlaying) }));

    await handler({ mode: 'recent' });

    expect(s3.puts).toHaveLength(1);
    const put = s3.puts[0]!;
    expect(put.Bucket).toBe('test-bucket');
    expect(put.Key).toBe(RECENT_KEY);
    expect(put.ContentType).toBe('application/json; charset=utf-8');
    expect(put.CacheControl).toBe('public, max-age=30');
    const file = JSON.parse(String(put.Body));
    expect(file.fetchedAt).toBe('2026-10-19T12:00:00.000Z');
    expect(file.tracks[0]).toEqual({
      track: { title: 'Spoonman', artist: 'Soundgarden', album: 'Superunknown (20th Anniversary)' },
      playing: true,
      at: null,
    });
    // last.fm is asked for 12 rows so that dropping a duplicate still leaves 10.
    const url = new URL(String(fetch.mock.calls[0]![0]));
    expect(url.searchParams.get('user')).toBe(USERNAME);
    expect(url.searchParams.get('limit')).toBe('12');
    expect(file.tracks.length).toBeLessThanOrEqual(10);
  });

  it('writes an empty track list for an account with no plays', async () => {
    const { handler, s3 } = setup(lastfmFetch(emptyAccount()));

    await handler({ mode: 'recent' });

    expect(JSON.parse(String(s3.puts[0]!.Body))).toEqual({ fetchedAt: '2026-10-19T12:00:00.000Z', tracks: [] });
  });
});

describe('write only when changed', () => {
  const recent = () => lastfmFetch({ 'user.getrecenttracks': () => jsonResponse(recentNowPlaying) });

  it('writes when the content changed', async () => {
    const s3 = fakeS3();
    await setup(recent(), { s3 }).handler({ mode: 'recent' });
    expect(s3.puts).toHaveLength(1);

    // The stored file now holds different tracks.
    const stored = JSON.parse(s3.objects[RECENT_KEY]!);
    s3.objects[RECENT_KEY] = JSON.stringify({ ...stored, tracks: stored.tracks.slice(1) });
    await setup(recent(), { s3 }).handler({ mode: 'recent' });

    expect(s3.puts).toHaveLength(2);
    expect(JSON.parse(String(s3.puts[1]!.Body))).toEqual(stored);
  });

  it('does not write when only fetchedAt differs', async () => {
    const s3 = fakeS3();
    await setup(recent(), { s3, now: () => new Date('2026-10-19T12:00:00Z') }).handler({ mode: 'recent' });
    expect(s3.puts).toHaveLength(1);

    await setup(recent(), { s3, now: () => new Date('2026-10-19T12:01:00Z') }).handler({ mode: 'recent' });

    expect(s3.gets).toEqual([RECENT_KEY, RECENT_KEY]);
    expect(s3.puts).toHaveLength(1);
  });

  it('writes on the first run, when the object does not exist yet (NoSuchKey)', async () => {
    const s3 = fakeS3();
    await setup(recent(), { s3 }).handler({ mode: 'recent' });
    expect(s3.gets).toEqual([RECENT_KEY]);
    expect(s3.puts).toHaveLength(1);
  });

  it('throws, and writes nothing, when reading the stored file fails with anything but NoSuchKey', async () => {
    silenceLogs();
    const s3 = fakeS3();
    s3.getError = Object.assign(new Error('Access Denied'), { name: 'AccessDenied' });

    await expect(setup(recent(), { s3 }).handler({ mode: 'recent' })).rejects.toThrow('Access Denied');
    expect(s3.puts).toEqual([]);
  });

  it('throws when the write fails', async () => {
    silenceLogs();
    const s3 = fakeS3();
    s3.putError = () => new Error('S3 is down');

    await expect(setup(recent(), { s3 }).handler({ mode: 'recent' })).rejects.toThrow('S3 is down');
  });
});

describe('top mode', () => {
  it('writes all 12 top lists, calling last.fm 3 at a time', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const answer = (body: unknown): Answer => async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return jsonResponse(body);
    };
    const { handler, s3, fetch } = setup(
      lastfmFetch({
        'user.gettopartists': answer(topArtistsWeek),
        'user.gettoptracks': answer(topTracksEmpty),
        'user.gettopalbums': answer(topAlbumsEmpty),
      }),
    );

    await handler({ mode: 'top' });

    expect(fetch).toHaveBeenCalledTimes(12);
    expect(maxInFlight).toBe(3);
    expect(s3.puts.map((p) => p.Key).sort()).toEqual(
      ['artists', 'tracks', 'albums'].flatMap((kind) => ['week', 'month', 'year', 'all'].map((p) => `music/top-${kind}-${p}.json`)).sort(),
    );
    for (const put of s3.puts) {
      expect(put.CacheControl).toBe('public, max-age=300');
      expect(put.ContentType).toBe('application/json; charset=utf-8');
    }
    const weekArtists = JSON.parse(String(s3.puts.find((p) => p.Key === 'music/top-artists-week.json')!.Body));
    expect(weekArtists).toMatchObject({ kind: 'artists', period: 'week', items: [{ name: 'Audioslave', plays: 10 }, expect.anything(), expect.anything()] });
    const periods = new Set(fetch.mock.calls.map((c) => new URL(String(c[0])).searchParams.get('period')));
    expect(periods).toEqual(new Set(['7day', '1month', '12month', 'overall']));
  });

  it('on a partial failure writes the files that succeeded, then throws', async () => {
    silenceLogs();
    const { handler, s3 } = setup(
      lastfmFetch(
        emptyAccount({
          'user.gettoptracks': (url) =>
            url.searchParams.get('period') === 'overall' ? jsonResponse({ error: 6, message: 'User not found' }) : jsonResponse(topTracksEmpty),
        }),
      ),
    );

    await expect(handler({ mode: 'top' })).rejects.toThrow(/1 of 12/);

    expect(s3.puts).toHaveLength(11);
    expect(s3.puts.map((p) => p.Key)).not.toContain('music/top-tracks-all.json');
  });

  it('writes nothing for a list that is unchanged', async () => {
    const s3 = fakeS3();
    await setup(lastfmFetch(emptyAccount()), { s3, now: () => new Date('2026-10-19T12:00:00Z') }).handler({ mode: 'top' });
    expect(s3.puts).toHaveLength(12);

    await setup(lastfmFetch(emptyAccount()), { s3, now: () => new Date('2026-10-19T18:00:00Z') }).handler({ mode: 'top' });

    expect(s3.puts).toHaveLength(12);
  });
});

describe('last.fm failures write nothing and throw', () => {
  const cases: [string, () => Response | Promise<Response>, RegExp][] = [
    ['an error status', () => new Response('nope', { status: 500 }), /500/],
    ['an error body with status 200', () => jsonResponse({ error: 8, message: 'Operation failed' }), /Operation failed/],
    ['an error body with an error status', () => jsonResponse({ error: 29, message: 'Rate limit exceeded' }, 429), /Rate limit exceeded/],
    ['a body that is not JSON', () => new Response('<html>bad gateway</html>', { status: 200 }), /JSON/],
    ['a body without the expected list', () => jsonResponse({ user: 'x' }), /unexpected/i],
    ['a body with a non-numeric play count', () => jsonResponse({ topartists: { artist: [{ name: 'X', playcount: 'lots' }] } }), /unexpected/i],
  ];

  it.each(cases)('recent: %s', async (_name, answer, message) => {
    silenceLogs();
    const { handler, s3 } = setup(lastfmFetch({ 'user.getrecenttracks': answer }));

    await expect(handler({ mode: 'recent' })).rejects.toThrow(message);
    expect(s3.puts).toEqual([]);
  });

  it('top: a non-numeric play count in a 200 body fails that list only', async () => {
    silenceLogs();
    const { handler, s3 } = setup(
      lastfmFetch(emptyAccount({ 'user.gettopartists': () => jsonResponse({ topartists: { artist: [{ name: 'X', playcount: 'lots' }] } }) })),
    );

    await expect(handler({ mode: 'top' })).rejects.toThrow(/4 of 12/);
    expect(s3.puts).toHaveLength(8);
  });

  it('a timeout (aborted fetch) writes nothing and throws', async () => {
    silenceLogs();
    const fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      // Never answers; ends only when the handler's timeout signal fires.
      await new Promise((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason)));
      return jsonResponse({});
    });
    vi.useFakeTimers();
    try {
      const { handler, s3 } = setup(fetch);
      const result = expect(handler({ mode: 'recent' })).rejects.toThrow(/timed out|abort/i);
      await vi.advanceTimersByTimeAsync(8_000);
      await result;
      expect(s3.puts).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a timeout while reading the body also counts', async () => {
    silenceLogs();
    vi.useFakeTimers();
    try {
      const fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        const body = new ReadableStream({
          start(controller) {
            init!.signal!.addEventListener('abort', () => controller.error(init!.signal!.reason));
          },
        });
        return new Response(body, { status: 200 });
      });
      const { handler, s3 } = setup(fetch);
      const result = expect(handler({ mode: 'recent' })).rejects.toThrow(/timed out|abort/i);
      await vi.advanceTimersByTimeAsync(8_000);
      await result;
      expect(s3.puts).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('SSM', () => {
  const recent = () => lastfmFetch({ 'user.getrecenttracks': () => jsonResponse(recentNowPlaying) });

  it('reads the API key with decryption and the username, and caches them after a success', async () => {
    const ssm = fakeSsm();
    const { handler } = setup(recent(), { ssm });

    await handler({ mode: 'recent' });
    await handler({ mode: 'recent' });

    expect(ssm.calls).toEqual(
      expect.arrayContaining([
        { Name: env.API_KEY_PARAM, WithDecryption: true },
        { Name: env.USERNAME_PARAM, WithDecryption: true },
      ]),
    );
    expect(ssm.calls).toHaveLength(2);
  });

  it('retries after a failed load rather than caching the failure', async () => {
    silenceLogs();
    const ssm = fakeSsm();
    const { handler, s3 } = setup(recent(), { ssm });

    ssm.error = new Error('ThrottlingException');
    await expect(handler({ mode: 'recent' })).rejects.toThrow('ThrottlingException');
    expect(s3.puts).toEqual([]);

    ssm.error = undefined;
    await handler({ mode: 'recent' });
    expect(s3.puts).toHaveLength(1);
  });

  it('fails when a parameter has no value', async () => {
    silenceLogs();
    const ssm = fakeSsm();
    ssm.send = async () => ({ Parameter: {} });
    await expect(setup(recent(), { ssm }).handler({ mode: 'recent' })).rejects.toThrow(/no value/);
  });
});

describe('secrets', () => {
  it('never put the API key in logs or errors, even when fetch fails with the URL in its message', async () => {
    const spies = silenceLogs();
    const fetch = vi.fn(async (input: string | URL | Request) => {
      throw new TypeError(`fetch failed: ${String(input)}`);
    });
    const { handler } = setup(fetch);

    const error = await handler({ mode: 'recent' }).catch((e: unknown) => e as Error);

    expect(error).toBeInstanceOf(Error);
    expect(String((error as Error).message) + String((error as Error).stack) + String((error as Error).cause)).not.toContain(API_KEY);
    expect(logged(spies)).not.toContain(API_KEY);
    expect(logged(spies)).not.toContain('api_key=');
  });

  it('does not log the key on a success or a last.fm error either', async () => {
    const spies = silenceLogs();
    await setup(lastfmFetch({ 'user.getrecenttracks': () => jsonResponse(recentNowPlaying) })).handler({ mode: 'recent' });
    await setup(lastfmFetch({ 'user.getrecenttracks': () => jsonResponse({ error: 10, message: `Invalid API key ${API_KEY}` }) }))
      .handler({ mode: 'recent' })
      .catch(() => {});
    expect(logged(spies)).not.toContain(API_KEY);
  });
});

describe('modes', () => {
  it.each([[{ mode: 'weekly' }], [{}], [undefined], [null]])('rejects %j without calling anything', async (event) => {
    silenceLogs();
    const { handler, fetch, s3, ssm } = setup(lastfmFetch({}));

    await expect(handler(event as never)).rejects.toThrow(/mode/);
    expect(fetch).not.toHaveBeenCalled();
    expect(s3.puts).toEqual([]);
    expect(ssm.calls).toEqual([]);
  });
});
