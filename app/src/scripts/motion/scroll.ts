/**
 * Scroll-and-lock helper: sends the page to the Name card (`top`) or a Section,
 * smoothly unless the visitor prefers reduced motion. Used by the Terminal's `cd`.
 *
 * mvd-034.6 extends `goTo` with Lock-on and points the Cels, [ mvd ] and
 * back-to-top at it, so every caller gets Lock-on for free.
 */
import type { ScrollTarget } from '../../lib/terminal/commands.ts';

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function goTo(target: ScrollTarget): void {
  document.getElementById(target)?.scrollIntoView({
    block: 'start',
    behavior: reducedMotion() ? 'auto' : 'smooth',
  });
}
