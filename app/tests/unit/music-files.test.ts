import { describe, expect, it } from 'vitest';
import { PERIODS, RECENT_KEY, TOP_KINDS, topKey } from '../../src/lib/music/files.ts';

describe('music file keys', () => {
  it('names the recent file and one top file per kind and period', () => {
    expect(RECENT_KEY).toBe('music/recent.json');
    expect(topKey('artists', 'week')).toBe('music/top-artists-week.json');
    expect(topKey('albums', 'all')).toBe('music/top-albums-all.json');
    const keys = TOP_KINDS.flatMap((kind) => PERIODS.map((period) => topKey(kind, period)));
    expect(new Set(keys).size).toBe(12);
  });
});
