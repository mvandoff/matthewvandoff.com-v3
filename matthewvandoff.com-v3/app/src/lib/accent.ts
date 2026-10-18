/**
 * Accent tuning (pure, no DOM): turns any `accent` input into an Accent hex, as the
 * board's tune() does (design/reference/warm-terminal.html). Anything that isn't
 * a preset is re-tuned to OKLCH L 0.78, C 0.08 (chroma reduced until in gamut);
 * grays (C < 0.02) become the warm neutral (L 0.8, C 0.012, H 80).
 *
 * Parsing an arbitrary CSS colour needs the browser, so it is injected
 * (`ColourParser`); everything else here is plain arithmetic, step for step the
 * board's, so the same input gives the same hex.
 */

/** The default Accent (teal). tokens.css declares the same value as --accent-default. */
export const defaultAccent = '#8fb3ad';

/** Named presets: set as is, never tuned. */
export const accentPresets: Record<string, string> = {
  peach: '#e3a98b',
  teal: '#8fb3ad',
  lilac: '#c9a8d8',
  gold: '#d8c48f',
};

/** localStorage key of the visitor's Accent override (the Accent store and the head script). */
export const accentStorageKey = 'mvd.accent';

/** What a stored or applied Accent must look like: a lower-case 6-digit hex. */
export const isAccentHex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/.test(value);

/**
 * Normalises a CSS colour the way a canvas does (`ctx.fillStyle = css`, read back:
 * `#rrggbb`, or e.g. `rgba(r, g, b, a)`), or null when the browser doesn't
 * accept it as a colour.
 */
export type ColourParser = (css: string) => string | null;

export interface TuneDeps {
  parseColour: ColourParser;
  /** 0 ≤ x < 1, for `random`. */
  random(): number;
}

export interface Tuned {
  hex: string;
  /** What `accent → …` names it: the input, `hue N`, or the input + gray note. */
  label: string;
}

const TL = 0.78;
const TC = 0.08;

/** OKLCH → sRGB hex, stepping chroma down by 0.004 until the colour is in gamut. */
function toHex(L: number, C: number, H: number): string {
  const unlin = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  let rgb = [0, 0, 0];
  for (let cc = C; cc >= 0; cc -= 0.004) {
    const a = cc * Math.cos((H * Math.PI) / 180);
    const b = cc * Math.sin((H * Math.PI) / 180);
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    rgb = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    if (rgb.every((v) => v >= -0.0001 && v <= 1.0001)) break;
  }
  return (
    '#' +
    rgb
      .map((v) =>
        Math.round(Math.min(1, Math.max(0, unlin(Math.min(1, Math.max(0, v))))) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/**
 * Tunes lower-cased input `n` (not a preset, not `reset`): `random`, a hue
 * 0–360 (optional `deg`), bare 3/6-digit hex, or any CSS colour. null = not a
 * colour. Order matters and is the board's: a number up to 360 is a hue even
 * when it is also valid hex (`210`); above 360, 3 digits read as hex (`400`).
 */
export function tune(n: string, { parseColour, random }: TuneDeps): Tuned | null {
  if (n === 'random') {
    const h = Math.floor(random() * 360);
    return { hex: toHex(TL, TC, h), label: `hue ${h}` };
  }
  if (/^\d{1,3}(\.\d+)?(deg)?$/.test(n) && parseFloat(n) <= 360) {
    const h = parseFloat(n);
    return { hex: toHex(TL, TC, h), label: `hue ${Math.round(h)}` };
  }
  const css = /^[0-9a-f]{3}$|^[0-9a-f]{6}$/.test(n) ? '#' + n : n;
  const v = parseColour(css);
  if (v === null) return null;
  let r: number, g: number, b: number;
  if (v.charAt(0) === '#') {
    r = parseInt(v.slice(1, 3), 16);
    g = parseInt(v.slice(3, 5), 16);
    b = parseInt(v.slice(5, 7), 16);
  } else {
    // As on the board: the first three numbers of the serialisation, whatever
    // its colour space (so oklch()/color() serialisations read oddly, the same way).
    const m = v.match(/[\d.]+/g);
    if (!m || m.length < 3) return null;
    r = +m[0]!;
    g = +m[1]!;
    b = +m[2]!;
  }
  const lin = (c: number) => {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const R = lin(r),
    G = lin(g),
    B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m2 = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s2 = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const A = 1.9779984951 * l - 2.428592205 * m2 + 0.4505937099 * s2;
  const Bb = 0.0259040371 * l + 0.7827717662 * m2 - 0.808675766 * s2;
  const C = Math.sqrt(A * A + Bb * Bb);
  const H = ((Math.atan2(Bb, A) * 180) / Math.PI + 360) % 360;
  if (C < 0.02) return { hex: toHex(0.8, 0.012, 80), label: `${n} (gray → warm neutral)` };
  return { hex: toHex(TL, TC, H), label: n };
}
