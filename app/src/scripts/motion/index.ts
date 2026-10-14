/**
 * Motion controller: all non-Terminal page behaviour, started once per page load.
 *
 * So far it runs the live clock. Later tickets add the rest here, each skipped or
 * short-circuited under prefers-reduced-motion:
 *   mvd-034.6  scroll tracking (prompt, progress, header border), reveal, smooth
 *              scroll + Lock-on
 *   mvd-034.7  Boot and name-intro timing, ASCII coin flip, field and blobs
 *   mvd-034.8  Crosshair/HUD pointer tracking, github/linkedin scramble
 */
import { startClock } from './clock.ts';

startClock();
