/**
 * The github/linkedin glyph scramble (board `scramble()`, warm-terminal.html
 * 962-986). On hover or focus of a `.big` link the word in its `.dw-live` turns to
 * noise, then resolves one letter per 34ms tick after 6 all-noise ticks: the live
 * span shows the resolved prefix plus a `.nz` noise tail of the remaining length,
 * then the plain word. The `.dw-ghost` copy reserves the word's width and the live
 * span is absolutely positioned, so nothing moves.
 *
 * Skipped under reduced motion. Restarts from noise if retriggered mid-scramble,
 * as on the board. Glyphs come from Math.random (seeded in the design harness).
 */
import { reducedMotion } from './scroll.ts';

const GLYPHS = '!<>-_\\/[]{}=+*^?#01';
const TICK_MS = 34;
const LEAD = 6;

export interface ScrambleFrame {
  done: string;
  noise: string;
}

/** Frame `frame` (0 = the trigger) of scrambling `word`, or null once it has resolved. */
export function scrambleFrame(word: string, frame: number, random: () => number = Math.random): ScrambleFrame | null {
  const shown = Math.max(0, frame - LEAD);
  if (frame > 0 && shown >= word.length) return null;
  let noise = '';
  for (let i = shown; i < word.length; i++) noise += GLYPHS[Math.floor(random() * GLYPHS.length)];
  return { done: word.slice(0, shown), noise };
}

export function startScramble(): void {
  for (const link of document.querySelectorAll<HTMLElement>('[data-scramble]')) {
    const word = link.dataset['scramble'] ?? '';
    const live = link.querySelector<HTMLElement>('.dw-live');
    const nz = live?.querySelector<HTMLElement>('.nz');
    if (!live || !nz || !word) continue;
    const text = live.firstChild instanceof Text ? live.firstChild : live.insertBefore(new Text(word), nz);
    let timer = 0;

    /** Resolved prefix + noise tail, or (null) the plain word. */
    const show = (frame: ScrambleFrame | null) => {
      text.data = frame ? frame.done : word;
      nz.textContent = frame ? frame.noise : '';
    };

    const run = () => {
      if (reducedMotion()) return;
      clearInterval(timer);
      let frame = 0;
      show(scrambleFrame(word, frame));
      timer = window.setInterval(() => {
        const next = scrambleFrame(word, ++frame);
        show(next);
        if (!next) clearInterval(timer);
      }, TICK_MS);
    };

    link.addEventListener('mouseenter', run);
    link.addEventListener('focus', run);
  }
}
