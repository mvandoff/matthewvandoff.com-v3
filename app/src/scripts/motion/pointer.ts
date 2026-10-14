/**
 * Pointer tracking (board `_onMove`, warm-terminal.html 655-668): writes the cursor
 * position to <html> as --mx/--my (integers, registered in global.css with a resting
 * value of -200). The name ghosts and the background field read them in CSS.
 *
 * The board sets these even under reduced motion; its CSS then drops the
 * transitions (ghosts) or the transform (field). We do the same.
 *
 * mvd-034.8 (Crosshair) extends `onMove` with --cv, --mfx/--mfy and --xh, and adds
 * the board's `_onOut` (mouse leaving the window) here.
 */
export function startPointer(): void {
  const root = document.documentElement;
  const onMove = (e: MouseEvent) => {
    root.style.setProperty('--mx', String(Math.round(e.clientX)));
    root.style.setProperty('--my', String(Math.round(e.clientY)));
  };
  document.addEventListener('mousemove', onMove, { passive: true });
}
