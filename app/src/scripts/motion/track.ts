/**
 * Scroll tracking (board `track()`, warm-terminal.html 690-722), run on load and
 * on scroll/resize, throttled to one run per animation frame.
 *
 * So far it writes to <html>: --sp (scroll progress 0-1, 4 decimals; the background
 * field, the header progress line and the HUD mini-map's scroll marker read it),
 * --spi (0-100) and --hlift (px of footer showing, so the Crosshair HUD lifts
 * above it). Runs under reduced motion too, as on the board (CSS keeps the field
 * still).
 *
 * mvd-034.6 adds the rest of `track()` to `update`: the current Section for the
 * header prompt, the `.down` header border, reveal-on-scroll.
 */
export function startTracking(): void {
  const root = document.getElementById('top');
  if (!root) return;
  const html = document.documentElement;
  const foot = document.getElementById('foot');

  const update = () => {
    const rect = root.getBoundingClientRect();
    const vh = window.innerHeight || 0;
    const span = rect.height - vh;
    const progress = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
    html.style.setProperty('--sp', progress.toFixed(4));
    html.style.setProperty('--spi', String(Math.round(progress * 100)));
    const lift = foot && vh ? Math.max(0, Math.round(vh - foot.getBoundingClientRect().top)) : 0;
    html.style.setProperty('--hlift', String(lift));
  };

  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  };
  document.addEventListener('scroll', schedule, { capture: true, passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  update();
}
