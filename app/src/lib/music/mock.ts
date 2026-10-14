/**
 * Mock music source reproducing the design's placeholder data (the board script
 * in design/reference/warm-terminal.html). The listening state is frozen at
 * "last played", per the spec.
 */
import type { MusicSource } from './source.ts';

export const mockMusic: MusicSource = {
  async nowPlaying() {
    return {
      track: { title: '[track title]', artist: '[artist]' },
      playing: false,
      ago: '2h ago',
      mock: true,
    };
  },
};
