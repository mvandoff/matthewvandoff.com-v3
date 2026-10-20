import { describe, expect, it } from 'vitest';
import { mapTopAlbums, mapTopArtists, mapTopTracks } from '../../src/lib/music/lastfm.ts';
import emptyAlbums from './fixtures/lastfm/top-albums-empty.json';
import topAlbumsAll from './fixtures/lastfm/top-albums-overall.json';
import emptyArtists from './fixtures/lastfm/top-artists-empty.json';
import topArtistsAll from './fixtures/lastfm/top-artists-overall.json';
import topArtistsWeek from './fixtures/lastfm/top-artists-7day.json';
import emptyTracks from './fixtures/lastfm/top-tracks-empty.json';
import topTracksWeek from './fixtures/lastfm/top-tracks-7day.json';

const fetchedAt = new Date('2026-10-19T12:00:00Z');

describe('top artists', () => {
  it('maps a user.gettopartists response, turning string play counts into numbers', () => {
    expect(mapTopArtists(topArtistsWeek, '7day', fetchedAt)).toEqual({
      fetchedAt: '2026-10-19T12:00:00.000Z',
      kind: 'artists',
      period: 'week',
      items: [
        { name: 'Audioslave', plays: 10 },
        { name: 'Andris Mattson', plays: 6 },
        { name: 'Gregory Porter', plays: 4 },
      ],
    });
  });
});

describe('periods', () => {
  it.each([
    ['7day', 'week'],
    ['1month', 'month'],
    ['12month', 'year'],
    ['overall', 'all'],
  ] as const)('maps last.fm %s to %s', (lastfm, period) => {
    expect(mapTopArtists(topArtistsWeek, lastfm, fetchedAt).period).toBe(period);
  });
});

describe('top tracks and albums', () => {
  it('maps user.gettoptracks with the artist', () => {
    const file = mapTopTracks(topTracksWeek, '7day', fetchedAt);
    expect(file.kind).toBe('tracks');
    expect(file.items[0]).toEqual({ name: 'What You Are', artist: 'Audioslave', plays: 3 });
  });

  it('maps user.gettopalbums with the artist, passing non-ASCII names through untouched', () => {
    const file = mapTopAlbums(topAlbumsAll, 'overall', fetchedAt);
    expect(file.kind).toBe('albums');
    expect(file.period).toBe('all');
    expect(file.items.at(-1)).toEqual({ name: 'Hærværk/Mesterværk', artist: 'SOLEIMA', plays: 2 });
  });

  it('passes non-ASCII artist names through untouched', () => {
    const file = mapTopArtists(topArtistsAll, 'overall', fetchedAt);
    expect(file.items.map((i) => i.name)).toContain('Héctor Lavoe');
  });
});

describe('empty account', () => {
  it.each([
    ['artists', () => mapTopArtists(emptyArtists, 'overall', fetchedAt)],
    ['tracks', () => mapTopTracks(emptyTracks, 'overall', fetchedAt)],
    ['albums', () => mapTopAlbums(emptyAlbums, 'overall', fetchedAt)],
  ] as const)('maps empty top %s to an empty list, not an error', (kind, map) => {
    expect(map()).toMatchObject({ kind, items: [] });
  });
});

describe('single-object lists', () => {
  it('reads a lone artist object as a one-item list, and a missing field as empty', () => {
    const [only] = topArtistsWeek.topartists.artist;
    expect(mapTopArtists({ topartists: { artist: only } }, '7day', fetchedAt).items).toEqual([{ name: 'Audioslave', plays: 10 }]);
    expect(mapTopArtists({ topartists: {} }, '7day', fetchedAt).items).toEqual([]);
  });

  it('does the same for tracks and albums', () => {
    const [track] = topTracksWeek.toptracks.track;
    const [album] = topAlbumsAll.topalbums.album;
    expect(mapTopTracks({ toptracks: { track } }, '7day', fetchedAt).items).toHaveLength(1);
    expect(mapTopAlbums({ topalbums: { album } }, 'overall', fetchedAt).items).toHaveLength(1);
    expect(mapTopTracks({ toptracks: {} }, '7day', fetchedAt).items).toEqual([]);
    expect(mapTopAlbums({ topalbums: {} }, 'overall', fetchedAt).items).toEqual([]);
  });
});
