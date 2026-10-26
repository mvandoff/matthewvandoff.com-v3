/**
 * Scroll tracking, run on load and
 * on scroll/resize, throttled to one run per animation frame.
 *
 * Writes to <html>: --sp (scroll progress 0-1, 4 decimals; the background field,
 * the header progress line and the HUD mini-map's scroll marker read it), --spi
 * (0-100) and --hlift (px of footer showing, so the Crosshair HUD lifts above it).
 * Sets the header prompt's current Section (`.bar .here`, in the prompt and the phone menu button), the header border
 * (`.bar.down` once scrolled past 8px) and reveal-on-scroll (`.rv` on each Section
 * once JS runs, `.in` once seen, for good).
 *
 * Runs under reduced motion too; CSS keeps the field still and
 * shows every Section outright.
 */
import { site } from '../../lib/content.ts';

export function startTracking(): void {
  const root = document.getElementById('top');
  if (!root) return;
  const html = document.documentElement;
  const foot = document.getElementById('foot');
  const bar = document.querySelector<HTMLElement>('.bar');
  const heres = [...document.querySelectorAll<HTMLElement>('.bar .here')];
  const sections = site.sections.map(({ id }) => document.getElementById(id)).filter((el) => el !== null);

  const update = () => {
    const rect = root.getBoundingClientRect();
    const vh = window.innerHeight || 0;
    const span = rect.height - vh;
    const progress = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
    html.style.setProperty('--sp', progress.toFixed(4));
    html.style.setProperty('--spi', String(Math.round(progress * 100)));
    const lift = foot && vh ? Math.max(0, Math.round(vh - foot.getBoundingClientRect().top)) : 0;
    html.style.setProperty('--hlift', String(lift));

    // Current Section: the last one whose top has passed 200px; links at the very bottom.
    let current = 'home';
    for (const section of sections) if (section.getBoundingClientRect().top <= 200) current = section.id;
    const scrolled = rect.top < -8;
    if (scrolled && vh && rect.bottom <= vh + 4) current = 'links';
    for (const here of heres) if (here.textContent !== current) here.textContent = current;
    bar?.classList.toggle('down', scrolled);

    // Reveal: a Section is seen once its top is above 88% of the viewport, for good.
    for (const section of sections) {
      if (!section.classList.contains('in') && section.getBoundingClientRect().top < vh * 0.88) {
        section.classList.add('in');
      }
    }
  };

  // Hidden-until-seen only once JS runs. What's in view is measured before .rv
  // offsets anything, and
  // stays revealed. A Section named by the URL hash is where the browser is about
  // to land, so it starts seen too: offset by the reveal, the landing would be 32px short.
  const landing = decodeURIComponent(location.hash.slice(1));
  const vh = window.innerHeight || 0;
  const seen = sections.map((s) => s.id === landing || s.getBoundingClientRect().top < vh * 0.88);
  sections.forEach((section, i) => section.classList.add('rv', ...(seen[i] ? ['in'] : [])));

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
  // Layout settles as the fonts arrive; re-check what's in view then.
  document.fonts?.ready.then(schedule, () => {});
  update();
}
