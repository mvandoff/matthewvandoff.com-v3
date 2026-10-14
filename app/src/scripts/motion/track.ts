/**
 * Scroll tracking (board `track()`, warm-terminal.html 690-722), run on load and
 * on scroll/resize, throttled to one run per animation frame.
 *
 * So far it writes scroll progress to <html>: --sp (0-1, 4 decimals; the background
 * field and the header progress line read it) and --spi (0-100, for the HUD).
 * Runs under reduced motion too, as on the board (CSS keeps the field still).
 *
 * mvd-034.6 adds the rest of `track()` to `update`: the current Section for the
 * header prompt, the `.down` header border, reveal-on-scroll; mvd-034.8 adds
 * --hlift (HUD lift above the footer).
 */
export function startTracking(): void {
  const root = document.getElementById('top');
  if (!root) return;
  const html = document.documentElement;

  const update = () => {
    const rect = root.getBoundingClientRect();
    const vh = window.innerHeight || 0;
    const span = rect.height - vh;
    const progress = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
    html.style.setProperty('--sp', progress.toFixed(4));
    html.style.setProperty('--spi', String(Math.round(progress * 100)));
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
