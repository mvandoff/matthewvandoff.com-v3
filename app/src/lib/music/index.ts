/**
 * The music source the site uses. This is the one place to swap in another
 * implementation (e.g. last.fm behind a proxy); the Terminal reads only the
 * `MusicSource` interface.
 */
import { createMockMusic } from './mock.ts';
import type { MusicSource } from './source.ts';

export const music: MusicSource = createMockMusic();
