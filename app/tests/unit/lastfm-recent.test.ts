import { describe, expect, it } from 'vitest';
import { mapRecentTracks } from '../../src/lib/music/lastfm.ts';
import empty from './fixtures/lastfm/recent-empty.json';
import noAlbum from './fixtures/lastfm/recent-no-album.json';
import history from './fixtures/lastfm/recent-history.json';
import nowPlaying from './fixtures/lastfm/recent-now-playing.json';
import nothingPlaying from './fixtures/lastfm/recent-nothing-playing.json';

const fetchedAt = new Date('2026-10-19T12:00:00Z');

describe('recent tracks', () => {
  it('maps user.getrecenttracks, taking the time from date.uts (unix seconds as a string)', () => {
    const file = mapRecentTracks(nothingPlaying, fetchedAt, { limit: 10 });
    expect(file.fetchedAt).toBe('2026-10-19T12:00:00.000Z');
    expect(file.tracks).toHaveLength(10);
    expect(file.tracks[0]).toEqual({
      track: { title: 'Right Back To It', artist: 'Waxahatchee', album: 'Tigers Blood' },
      playing: false,
      at: '2026-10-18T20:06:45.000Z',
    });
  });

  it('maps an empty account to an empty list, not an error', () => {
    expect(mapRecentTracks(empty, fetchedAt, { limit: 10 })).toEqual({
      fetchedAt: '2026-10-19T12:00:00.000Z',
      tracks: [],
    });
  });
});

describe('now playing', () => {
  it('flags the playing track, which has no date, with a null start time', () => {
    const file = mapRecentTracks(nowPlaying, fetchedAt, { limit: 10 });
    expect(file.tracks[0]).toEqual({
      track: { title: 'Spoonman', artist: 'Soundgarden', album: 'Superunknown (20th Anniversary)' },
      playing: true,
      at: null,
    });
    expect(file.tracks.slice(1).every((t) => !t.playing)).toBe(true);
  });

  it('gives the same tracks at any fetch time, so the fetcher can skip unchanged writes', () => {
    const first = mapRecentTracks(nowPlaying, new Date('2026-10-19T12:00:00Z'), { limit: 10 });
    const later = mapRecentTracks(nowPlaying, new Date('2026-10-19T12:01:00Z'), { limit: 10 });
    expect(later.fetchedAt).not.toBe(first.fetchedAt);
    expect(later.tracks).toEqual(first.tracks);
  });

  it('cuts last.fm\'s extra row (limit=10 returns 11) back to the limit, dropping the oldest scrobble', () => {
    const scrobbles = nothingPlaying.recenttracks.track;
    expect(scrobbles).toHaveLength(10);
    const response = { recenttracks: { track: [nowPlaying.recenttracks.track[0], ...scrobbles] } };
    expect(response.recenttracks.track).toHaveLength(11);
    const file = mapRecentTracks(response, fetchedAt, { limit: 10 });
    expect(file.tracks).toHaveLength(10);
    expect(file.tracks[0].playing).toBe(true);
    // The oldest scrobble, "the understory" at 1792351790, is gone; the newest nine remain.
    expect(file.tracks.at(-1)).toMatchObject({ track: { title: 'Car Alarm' }, at: '2026-10-18T19:33:12.000Z' });
  });

  it('removes duplicates before cutting to the limit, so the result can be short but never padded', () => {
    // This response is 11 rows with one true duplicate (What You Are), so 10 plays once deduped.
    expect(nowPlaying.recenttracks.track).toHaveLength(11);
    const file = mapRecentTracks(nowPlaying, fetchedAt, { limit: 10 });
    expect(file.tracks).toHaveLength(10);
    expect(file.tracks.at(-1)?.track.title).toBe('Dårlige Idéer, Smukke Som Sne');
    expect(mapRecentTracks(nowPlaying, fetchedAt, { limit: 11 }).tracks).toHaveLength(10);
  });

  it('cuts to a smaller limit, keeping the playing track first', () => {
    const file = mapRecentTracks(nowPlaying, fetchedAt, { limit: 8 });
    expect(file.tracks.map((t) => t.track.title)).toEqual([
      'Spoonman',
      'Spoonman',
      'Set It Off',
      'What You Are',
      'Gasoline',
      'Show Me How To Live',
      'El Cantante',
      'My Shining Hour',
    ]);
    expect(file.tracks[0].playing).toBe(true);
  });

  it('keeps exactly the limit when nothing is playing, and flags nothing', () => {
    const file = mapRecentTracks(nothingPlaying, fetchedAt, { limit: 10 });
    expect(file.tracks).toHaveLength(10);
    expect(file.tracks.some((t) => t.playing)).toBe(false);
  });
});

describe('duplicates', () => {
  const file = mapRecentTracks(history, fetchedAt, { limit: 20 });
  const whatYouAre = file.tracks.filter((t) => t.track.title === 'What You Are').map((t) => t.at);

  it('drops the same track and artist scrobbled twice within seconds (9s apart)', () => {
    expect(whatYouAre).not.toContain('2026-10-12T22:18:12.000Z');
    expect(whatYouAre).toContain('2026-10-12T22:18:21.000Z');
  });

  it('keeps a real replay (191s apart)', () => {
    expect(whatYouAre).toContain('2026-10-10T16:10:29.000Z');
    expect(whatYouAre).toContain('2026-10-10T16:07:18.000Z');
  });

  it('drops a duplicate with another track between the two scrobbles', () => {
    const play = (name: string, uts: number) => ({
      name,
      artist: { '#text': 'X' },
      album: { '#text': '' },
      date: { uts: String(uts) },
    });
    const response = { recenttracks: { track: [play('A', 1000), play('B', 990), play('A', 980), play('A', 700)] } };
    const titles = mapRecentTracks(response, fetchedAt, { limit: 10 }).tracks.map((t) => [t.track.title, t.at]);
    // The A at 980 repeats the A at 1000; the A at 700 is a real replay.
    expect(titles).toEqual([
      ['A', '1970-01-01T00:16:40.000Z'],
      ['B', '1970-01-01T00:16:30.000Z'],
      ['A', '1970-01-01T00:11:40.000Z'],
    ]);
  });

  it('drops only the duplicate: 14 rows in, 13 out', () => {
    expect(history.recenttracks.track).toHaveLength(14);
    expect(file.tracks).toHaveLength(13);
  });
});

describe('album and names', () => {
  it('treats an empty album ("#text": "") as no album', () => {
    const [play] = mapRecentTracks(noAlbum, fetchedAt, { limit: 10 }).tracks;
    expect(play.track).toEqual({ title: 'Spoonman', artist: 'Soundgarden' });
    expect('album' in play.track).toBe(false);
  });

  it('passes non-ASCII names and title suffixes through untouched', () => {
    const titles = mapRecentTracks(history, fetchedAt, { limit: 20 }).tracks.map((t) => [t.track.title, t.track.artist]);
    expect(titles).toContainEqual(['Vilde Øjne', 'SOLEIMA']);
    expect(titles).toContainEqual(['Dårlige Idéer, Smukke Som Sne', 'SOLEIMA']);
    expect(titles).toContainEqual(['Shattered Dreams - Remastered 2008', 'Johnny Hates Jazz']);
    expect(titles).toContainEqual(['Liquid Spirit - Claptone Remix / Full Vocal Version', 'Gregory Porter']);
    expect(titles).toContainEqual(['Periódico de Ayer - Remastered 2024', 'Héctor Lavoe']);
  });
});

describe('single-object lists', () => {
  it('reads a lone track object as a one-item list, and a missing track field as empty', () => {
    const [only] = nothingPlaying.recenttracks.track;
    const file = mapRecentTracks({ recenttracks: { track: only } }, fetchedAt, { limit: 10 });
    expect(file.tracks.map((t) => t.track.title)).toEqual(['Right Back To It']);
    expect(mapRecentTracks({ recenttracks: {} }, fetchedAt, { limit: 10 }).tracks).toEqual([]);
  });
});
