/**
 * The fetcher Lambda's logic: read last.fm, map with src/lib/music, write the music files to S3.
 * One function for both schedules; the event says which (see ADR 0002). All I/O comes in through
 * createHandler so tests can fake it. Nothing here may import from Astro or the site.
 */

import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { GetParameterCommand } from '@aws-sdk/client-ssm';
import { PERIODS, RECENT_KEY, TOP_KINDS, topKey, type Period, type TopKind } from '../src/lib/music/files.ts';
import { mapRecentTracks, mapTopAlbums, mapTopArtists, mapTopTracks, type LastfmPeriod } from '../src/lib/music/lastfm.ts';

/** The one method of the AWS clients we use, so tests can pass fakes. */
interface Sender {
  send(command: any): Promise<any>;
}

export interface Deps {
  s3: Sender;
  ssm: Sender;
  fetch: typeof fetch;
  now: () => Date;
  env: { BUCKET: string; API_KEY_PARAM: string; USERNAME_PARAM: string };
}

export interface FetcherEvent {
  mode?: string;
}

const API_URL = 'https://ws.audioscrobbler.com/2.0/';
const TIMEOUT_MS = 8_000;
const TOP_CONCURRENCY = 3;
/** Asked of last.fm for recent tracks: mapping drops duplicates before applying its limit, so ask for more than the RECENT_LIMIT kept. */
const RECENT_FETCH_LIMIT = 30;
const RECENT_LIMIT = 25;
const TOP_LIMIT = 25;
const RECENT_CACHE = 'public, max-age=30';
const TOP_CACHE = 'public, max-age=300';

const LASTFM_PERIOD: Record<Period, LastfmPeriod> = { week: '7day', month: '1month', year: '12month', all: 'overall' };

interface Credentials {
  apiKey: string;
  username: string;
}

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isCount(value: unknown): boolean {
  return isString(value) && value.trim() !== '' && Number.isFinite(Number(value));
}

/** last.fm sends one item as an object and none as a missing field, so all three shapes are fine. */
function items(list: unknown): unknown[] | undefined {
  if (list === undefined) return [];
  if (Array.isArray(list)) return list;
  return isObj(list) ? [list] : undefined;
}

/** Whether `body[root][field]` has the shape the mapping reads. Throws a clear error when it doesn't. */
function expectShape(body: unknown, root: string, field: string, valid: (item: Obj) => boolean): void {
  const list = isObj(body) && isObj(body[root]) ? items(body[root][field]) : undefined;
  if (!list || !list.every((item) => isObj(item) && valid(item))) throw new Error(`unexpected ${root} response shape`);
}

const hasName = (item: Obj) => isString(item.name);
const hasArtistName = (item: Obj) => isObj(item.artist) && isString(item.artist.name);

function validateRecent(body: unknown): void {
  expectShape(body, 'recenttracks', 'track', (t) => {
    const album = t.album;
    const date = t.date;
    return (
      hasName(t) &&
      isObj(t.artist) &&
      isString(t.artist['#text']) &&
      isObj(album) &&
      isString(album['#text']) &&
      (t.image === undefined || !!items(t.image)?.every((i) => isObj(i) && isString(i.size) && isString(i['#text']))) &&
      (date === undefined || (isObj(date) && isCount(date.uts)))
    );
  });
}

export function createHandler(deps: Deps) {
  const { s3, ssm, env } = deps;
  let credentials: Credentials | undefined;
  /** The key of the current run, for redaction. Kept even when loading failed later in the run. */
  let knownKey: string | undefined;

  /** last.fm takes the key in the URL, so it must not reach a log or an error, even inside a fetch error's message. */
  function redact(text: string): string {
    let out = text.replace(/api_key=[^&\s"']*/g, '[redacted]');
    if (knownKey) out = out.replaceAll(knownKey, '[redacted]');
    return out;
  }

  function errorMessage(error: unknown): string {
    return redact(error instanceof Error ? error.message : String(error));
  }

  function log(event: string, fields: Record<string, unknown> = {}): void {
    console.log(JSON.stringify({ event, ...fields }));
  }

  function logError(event: string, error: unknown, fields: Record<string, unknown> = {}): void {
    console.error(JSON.stringify({ event, ...fields, error: errorMessage(error) }));
  }

  async function getParameter(name: string): Promise<string> {
    const res = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
    const value: unknown = res.Parameter?.Value;
    if (!isString(value) || value === '') throw new Error(`SSM parameter ${name} has no value`);
    return value;
  }

  /** Cached for the life of the instance, but only once both values loaded, so a failed load is retried next run. */
  async function loadCredentials(): Promise<Credentials> {
    if (credentials) return credentials;
    const [apiKey, username] = await Promise.all([getParameter(env.API_KEY_PARAM), getParameter(env.USERNAME_PARAM)]);
    knownKey = apiKey;
    credentials = { apiKey, username };
    return credentials;
  }

  /** One last.fm call. Resolves to the parsed body, or throws with a message that never contains the key. */
  async function lastfm(creds: Credentials, method: string, params: Record<string, string>): Promise<unknown> {
    const url = new URL(API_URL);
    const query = { method, user: creds.username, api_key: creds.apiKey, format: 'json', ...params };
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

    // Not AbortSignal.timeout: the timer has to cover reading the body, and fake timers can't drive that one.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('timed out')), TIMEOUT_MS);
    try {
      const res = await deps.fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'matthewvandoff.com-fetcher' },
      });
      const text = await res.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        body = undefined;
      }
      // last.fm reports errors as {error, message}, with a varying status code.
      if (isObj(body) && 'error' in body) throw new Error(`last.fm error ${String(body.error)}: ${String(body.message)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (body === undefined) throw new Error('response was not JSON');
      return body;
    } catch (error) {
      throw new Error(`last.fm ${method} failed: ${errorMessage(error)}`);
    } finally {
      clearTimeout(timer);
    }
  }

  /** The stored file's content without fetchedAt, or undefined when there is none (or it isn't ours to compare). */
  async function readStored(key: string): Promise<string | undefined> {
    let text: string;
    try {
      const res = await s3.send(new GetObjectCommand({ Bucket: env.BUCKET, Key: key }));
      text = await res.Body.transformToString();
    } catch (error) {
      // With s3:ListBucket a missing key is NoSuchKey. Anything else (AccessDenied, throttling) is a real failure.
      if (error instanceof Error && error.name === 'NoSuchKey') return undefined;
      throw error;
    }
    try {
      return withoutFetchedAt(JSON.parse(text));
    } catch {
      return undefined;
    }
  }

  function withoutFetchedAt(file: unknown): string {
    const { fetchedAt: _fetchedAt, ...rest } = file as Obj;
    return JSON.stringify(rest);
  }

  /** Writes `file` unless the stored content already matches it, ignoring fetchedAt. */
  async function publish(key: string, file: { fetchedAt: string }, cacheControl: string): Promise<void> {
    if ((await readStored(key)) === withoutFetchedAt(file)) {
      log('unchanged', { key });
      return;
    }
    await s3.send(
      new PutObjectCommand({
        Bucket: env.BUCKET,
        Key: key,
        Body: JSON.stringify(file),
        ContentType: 'application/json; charset=utf-8',
        CacheControl: cacheControl,
      }),
    );
    log('wrote', { key });
  }

  async function recent(creds: Credentials): Promise<void> {
    const body = await lastfm(creds, 'user.getrecenttracks', { limit: String(RECENT_FETCH_LIMIT) });
    validateRecent(body);
    const file = mapRecentTracks(body as Parameters<typeof mapRecentTracks>[0], deps.now(), { limit: RECENT_LIMIT });
    await publish(RECENT_KEY, file, RECENT_CACHE);
  }

  async function topList(creds: Credentials, kind: TopKind, period: Period): Promise<void> {
    const lastfmPeriod = LASTFM_PERIOD[period];
    const params = { period: lastfmPeriod, limit: String(TOP_LIMIT) };
    const fetchedAt = deps.now();
    let file;
    if (kind === 'artists') {
      const body = await lastfm(creds, 'user.gettopartists', params);
      expectShape(body, 'topartists', 'artist', (a) => hasName(a) && isCount(a.playcount));
      file = mapTopArtists(body as Parameters<typeof mapTopArtists>[0], lastfmPeriod, fetchedAt);
    } else if (kind === 'tracks') {
      const body = await lastfm(creds, 'user.gettoptracks', params);
      expectShape(body, 'toptracks', 'track', (t) => hasName(t) && hasArtistName(t) && isCount(t.playcount));
      file = mapTopTracks(body as Parameters<typeof mapTopTracks>[0], lastfmPeriod, fetchedAt);
    } else {
      const body = await lastfm(creds, 'user.gettopalbums', params);
      expectShape(body, 'topalbums', 'album', (a) => hasName(a) && hasArtistName(a) && isCount(a.playcount));
      file = mapTopAlbums(body as Parameters<typeof mapTopAlbums>[0], lastfmPeriod, fetchedAt);
    }
    await publish(topKey(kind, period), file, TOP_CACHE);
  }

  /**
   * All 12 lists, a few at a time. One bad list must not hold the others back, and 12 writes can't be
   * atomic anyway, so each list that works is published, each failure is logged, and the run throws at the end.
   */
  async function top(creds: Credentials): Promise<void> {
    const queue = TOP_KINDS.flatMap((kind) => PERIODS.map((period) => ({ kind, period })));
    const total = queue.length;
    const failures: string[] = [];
    async function worker(): Promise<void> {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const key = topKey(next.kind, next.period);
        try {
          await topList(creds, next.kind, next.period);
        } catch (error) {
          logError('failed', error, { key });
          failures.push(`${key}: ${errorMessage(error)}`);
        }
      }
    }
    await Promise.all(Array.from({ length: TOP_CONCURRENCY }, worker));
    if (failures.length > 0) throw new Error(`${failures.length} of ${total} top lists failed: ${failures.join('; ')}`);
  }

  return async function handler(event: FetcherEvent | null | undefined): Promise<void> {
    const mode = event?.mode;
    try {
      if (mode !== 'recent' && mode !== 'top') throw new Error(`unknown mode ${JSON.stringify(mode)}, expected "recent" or "top"`);
      const creds = await loadCredentials();
      await (mode === 'recent' ? recent(creds) : top(creds));
    } catch (error) {
      logError('run failed', error, { mode });
      // Rethrown so the invocation counts as an error in CloudWatch, with the key scrubbed from the message.
      throw error instanceof Error && error.message === errorMessage(error) ? error : new Error(errorMessage(error));
    }
  };
}
