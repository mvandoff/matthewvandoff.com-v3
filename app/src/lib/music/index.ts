/**
 * The music source the site uses. This is the one place to swap in another
 * implementation; the Terminal reads only the `MusicSource` interface.
 *
 * Which source, decided when the site is built:
 * - `PUBLIC_MUSIC_SOURCE=mock` or `files` sets it. Without it, `astro dev` uses the
 *   mock (no files are served there) and a production build uses the files.
 * - The e2e builds say which they want: the mock for most specs, the files for the
 *   real-data spec (playwright.config.ts). `PUBLIC_MUSIC_SOURCE=files astro dev` serves
 *   sample files (astro.config.mjs).
 * - A production build never falls back to the mock: files that are missing or unreadable
 *   make the Terminal's music commands fail, which is mvd-u5q.7's to word.
 */
import { createFilesMusic } from './files-source.ts';
import { createMockMusic } from './mock.ts';
import type { MusicSource } from './source.ts';

const choice = import.meta.env.PUBLIC_MUSIC_SOURCE ?? (import.meta.env.DEV ? 'mock' : 'files');

export const music: MusicSource = choice === 'mock' ? createMockMusic() : createFilesMusic();
