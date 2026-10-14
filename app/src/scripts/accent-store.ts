/**
 * Accent store: the visitor's Accent override, kept in localStorage and applied
 * as --accent on :root (--second and --third follow it, see styles/tokens.css).
 * Every storage access is guarded: when storage is unavailable or full, the
 * override still applies for the visit and the page falls back to teal on reload.
 *
 * BaseLayout's inline head script applies a stored override before
 * first paint, with the same key and the same validity check.
 */
import { accentStorageKey, defaultAccent, isAccentHex } from '../lib/accent.ts';

function read(): string | null {
  try {
    const value = localStorage.getItem(accentStorageKey);
    return isAccentHex(value) ? value : null;
  } catch {
    return null;
  }
}

function write(hex: string | null): void {
  try {
    if (hex) localStorage.setItem(accentStorageKey, hex);
    else localStorage.removeItem(accentStorageKey);
  } catch {
    // Storage unavailable or full: the Accent lasts for this visit only.
  }
}

function apply(hex: string | null): void {
  const root = document.documentElement.style;
  if (hex) root.setProperty('--accent', hex);
  else root.removeProperty('--accent');
}

let override: string | null = read();

/** The Accent in use: the override, else the default. */
export const currentAccent = (): string => override ?? defaultAccent;

export function setAccent(hex: string): void {
  if (!isAccentHex(hex)) return;
  override = hex;
  apply(hex);
  write(hex);
}

export function clearAccent(): void {
  override = null;
  apply(null);
  write(null);
}

/**
 * The browser's CSS-colour parsing for Accent tuning: what a canvas serialises
 * `css` to, or null when it isn't a colour (as the board does it).
 */
export function parseColour(css: string): string | null {
  try {
    if (!CSS.supports('color', css)) return null;
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#010203';
    ctx.fillStyle = css;
    return String(ctx.fillStyle);
  } catch {
    return null;
  }
}
