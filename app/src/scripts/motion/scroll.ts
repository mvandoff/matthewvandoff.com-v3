/**
 * Scroll-and-lock helper (board `local()`, warm-terminal.html 737-748): sends the
 * page to the Name card (`top`) or a Section and, once the smooth scroll has
 * landed, shows a brief Lock-on bracket on the Name card's whoami line or the
 * Section heading ("found ~/about").
 *
 * Callers: the Terminal's `cd` (via `goTo`), and every in-page link to one of
 * those targets (the Cels, [ mvd ], back-to-top) via `startNavigation`.
 *
 * Reduced motion: an instant jump and no Lock-on (CSS hides `.lock` too).
 */
import type { ScrollTarget } from '../../lib/terminal/commands.ts';

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const TARGETS: readonly ScrollTarget[] = ['top', 'about', 'experience', 'links'];

/** Board timings: the bracket mounts 650ms after the click and unmounts at 2250ms. */
export const LOCK_SHOW_MS = 650;
export const LOCK_HIDE_MS = 2250;

let showTimer = 0;
let hideTimer = 0;

const lockParts = (target?: ScrollTarget) =>
  document.querySelectorAll<HTMLElement>(target ? `[data-lock="${target}"]` : '[data-lock]');

function setLock(target: ScrollTarget | null): void {
  for (const el of lockParts()) el.hidden = true;
  if (target) for (const el of lockParts(target)) el.hidden = false;
}

export function goTo(target: ScrollTarget): void {
  const reduce = reducedMotion();
  document.getElementById(target)?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  if (reduce) return;
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  setLock(null);
  showTimer = window.setTimeout(() => setLock(target), LOCK_SHOW_MS);
  hideTimer = window.setTimeout(() => setLock(null), LOCK_HIDE_MS);
}

const isTarget = (id: string): id is ScrollTarget => (TARGETS as readonly string[]).includes(id);

/**
 * Routes clicks on in-page links to `#top`/`#about`/`#experience`/`#links`
 * through `goTo`. As on the board the URL keeps no hash. Modified clicks (new
 * tab, etc.) are left to the browser; without JS the links are plain anchors.
 */
export function startNavigation(): void {
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest?.('a[href^="#"]');
    const id = link?.getAttribute('href')?.slice(1) ?? '';
    if (!isTarget(id)) return;
    event.preventDefault();
    goTo(id);
  });
}
