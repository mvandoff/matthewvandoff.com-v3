/**
 * Motion controller: all non-Terminal page behaviour, started once per page load.
 *
 * Pieces (each its own module with a `start*()` function):
 *   entrance  Boot, name glitch and ASCII coin flip. Starts BEFORE this module,
 *             from the inline script in components/Boot.astro (it must run before
 *             first paint); timings live in entrance.ts.
 *   clock     the Name card's live clock
 *   pointer   --mx/--my/--cv/--mfx/--mfy/--xh on <html> and the HUD values (name
 *             ghosts, background field, Crosshair)
 *   track     scroll progress --sp/--spi and --hlift on <html> (background field,
 *             progress line, HUD)
 *   scramble  the github/linkedin glyph scramble on hover and focus
 * Looping ambience (blob drift, fish, kaomoji, cursor blink) is pure CSS.
 *
 * Reduced motion: each piece is skipped or short-circuited as on the board; the
 * CSS side is the reduced-motion block at the bottom of styles/global.css.
 *
 * Still to come:
 *   mvd-034.6  track: header prompt, header border, reveal; scroll.ts: Lock-on
 */
import { startClock } from './clock.ts';
import { startPointer } from './pointer.ts';
import { startScramble } from './scramble.ts';
import { startNavigation } from './scroll.ts';
import { startTracking } from './track.ts';

startClock();
startPointer();
startTracking();
startScramble();
startNavigation();
