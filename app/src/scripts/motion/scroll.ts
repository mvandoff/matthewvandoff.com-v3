/**
 * Scroll-and-lock helper: sends the
 * page to the Name card (`top`) or a Section and, once the smooth scroll has
 * landed, shows a brief Lock-on bracket on the Name card's whoami line or the
 * Section heading ("found ~/about").
 *
 * Callers: the Terminal's `cd` (via `goTo`), and every in-page link to one of
 * those targets (the Cels, [ mvd ], back-to-top) via `startNavigation`.
 *
 * Reduced motion: an instant jump and no Lock-on (CSS hides `.lock` too).
 */
import { scrollTargets, type ScrollTarget } from '../../lib/terminal/commands.ts';

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Lock-on timings: the bracket mounts 650ms after the click and unmounts at 2250ms. */
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

/**
 * The element's page offset without its transform. A Section not yet revealed
 * sits 32px low (.rv); scrollIntoView would land that much short, so this
 * measures the Section itself.
 */
function layoutTop(el: HTMLElement): number {
  const shift = new DOMMatrixReadOnly(getComputedStyle(el).transform).f;
  return el.getBoundingClientRect().top + window.scrollY - shift;
}

export function goTo(target: ScrollTarget): void {
  const reduce = reducedMotion();
  const el = document.getElementById(target);
  if (el) window.scrollTo({ top: layoutTop(el), behavior: reduce ? 'auto' : 'smooth' });
  if (reduce) return;
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  setLock(null);
  showTimer = window.setTimeout(() => setLock(target), LOCK_SHOW_MS);
  hideTimer = window.setTimeout(() => setLock(null), LOCK_HIDE_MS);
}

const isTarget = (id: string): id is ScrollTarget => (scrollTargets as readonly string[]).includes(id);

/** Drops the hash from the URL without scrolling or adding a history entry. */
function clearHash(): void {
  if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
}

/** Resolves once the page has loaded and its fonts have settled the layout. */
function settled(): Promise<unknown> {
  const loaded = new Promise((resolve) => {
    if (document.readyState === 'complete') resolve(undefined);
    else window.addEventListener('load', resolve, { once: true });
  });
  return Promise.all([loaded, document.fonts?.ready]);
}

/**
 * Routes clicks on in-page links to `#top`/`#about`/`#experience`/`#links`
 * through `goTo`. The URL keeps no hash: a click never adds one, and one typed
 * or landed on is dropped once the page is there. Modified clicks (new
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
  // A hash typed on the page: the browser jumps to the Section's offset box (32px
  // short if it isn't revealed yet); settle it on the Section itself, then drop the hash.
  window.addEventListener('hashchange', () => {
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el && isTarget(el.id)) window.scrollTo({ top: layoutTop(el), behavior: 'auto' });
    clearHash();
  });
  // A hash in the landing URL (the 404's links, a shared link): the browser lands on
  // it and keeps it in place while late fonts move the layout, so the hash goes only
  // once that's done.
  if (location.hash) settled().then(() => requestAnimationFrame(clearHash), () => {});
}
