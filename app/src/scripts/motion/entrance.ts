/**
 * Entrance timing.
 *
 * The entrance starts in an inline script at the top of <body> (Boot.astro), not in
 * the Motion controller module: it must set its classes before first paint so the
 * Boot covers the page from the first frame and the name is hidden until it glitches
 * in, and the CSS animations and these timers then share one start. Everything is
 * skipped under prefers-reduced-motion and without JavaScript (the page renders
 * static and fully visible).
 */
export const entrance = {
  /** `html.booting` shows the Boot overlay; removed after this. */
  bootMs: 1450,
  /** `html.glitching` runs the name glitch; removed after this. */
  introMs: 3600,
} as const;
