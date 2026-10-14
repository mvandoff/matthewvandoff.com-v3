/**
 * Pointer tracking (board `_onMove`/`_onOut`, warm-terminal.html 655-674). On every
 * mousemove it writes to <html>:
 *   --mx/--my   cursor position in px (integers, registered in global.css with a
 *               resting value of -200): name ghosts, background field, Crosshair
 *   --cv        1 = the Crosshair is visible (it starts at 0, so it only appears
 *               after a real mouse move)
 *   --mfx/--mfy cursor position as a 0-1 fraction of the viewport (4dp): HUD
 *               rulers and mini-map
 *   --xh        1 while over something clickable: grows the Crosshair square
 * and prints the zero-padded x/y into the HUD. When the mouse leaves the window,
 * --cv and --xh drop to 0.
 *
 * The board sets these even under reduced motion and on touch; CSS then hides the
 * Crosshair and drops the transitions. We do the same.
 */
const CLICKABLE = 'a, button, label, input, select, textarea, [role="button"], .tgt';

/** A HUD coordinate: zero-padded to four digits, like the board's z4 counter style. */
export const hudValue = (n: number): string => (n < 0 ? '-' + String(-n).padStart(3, '0') : String(n).padStart(4, '0'));

export function startPointer(): void {
  const root = document.documentElement;
  const hudX = document.querySelector<HTMLElement>('[data-hud="x"]');
  const hudY = document.querySelector<HTMLElement>('[data-hud="y"]');
  const set = (name: string, value: string) => root.style.setProperty(name, value);
  const fraction = (v: number, of: number) => Math.min(1, Math.max(0, v / (of || 1))).toFixed(4);

  const onMove = (e: MouseEvent) => {
    const x = Math.round(e.clientX);
    const y = Math.round(e.clientY);
    set('--mx', String(x));
    set('--my', String(y));
    set('--cv', '1');
    set('--mfx', fraction(e.clientX, window.innerWidth));
    set('--mfy', fraction(e.clientY, window.innerHeight));
    const target = e.target instanceof Element ? e.target : null;
    set('--xh', target?.closest(CLICKABLE) ? '1' : '0');
    if (hudX) hudX.textContent = hudValue(x);
    if (hudY) hudY.textContent = hudValue(y);
  };

  const onOut = (e: MouseEvent) => {
    if (e.relatedTarget) return;
    set('--cv', '0');
    set('--xh', '0');
  };

  document.addEventListener('mousemove', onMove, { passive: true });
  document.addEventListener('mouseout', onOut);
}
