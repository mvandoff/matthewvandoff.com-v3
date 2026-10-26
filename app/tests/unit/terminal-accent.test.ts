/**
 * The `accent` command and Accent tuning. Every expected hex is a literal read off
 * the board's own Terminal (design/reference/warm-terminal.html, tune()), run in
 * Chromium.
 */
import { describe, expect, it } from 'vitest';
import { createMockMusic } from '../../src/lib/music/mock.ts';
import { execute, type Line, type TerminalContext } from '../../src/lib/terminal/commands.ts';

/**
 * What Chromium's canvas serialises each CSS colour to (`ctx.fillStyle = css`),
 * for the colours these tests use. Anything else is "not a CSS colour".
 */
const canvas: Record<string, string> = {
  red: '#ff0000',
  navy: '#000080',
  gray: '#808080',
  white: '#ffffff',
  transparent: 'rgba(0, 0, 0, 0)',
  '#3af': '#33aaff',
  '#abcdef': '#abcdef',
  '#fff': '#ffffff',
  '#400': '#440000',
  '#361': '#336611',
  '#0000ff': '#0000ff',
  'rgb(255 0 0 / 50%)': 'rgba(255, 0, 0, 0.5)',
  'rgb(10,200,90)': '#0ac85a',
  'hsl(200 15% 50%)': '#6c8693',
  'hsl(200 5% 50%)': '#798286',
  'oklch(0.7 0.2 30)': 'oklch(0.7 0.2 30)',
  'color(display-p3 1 0 0)': 'color(display-p3 1 0 0)',
};

const now = () => new Date(2026, 9, 14, 9, 30, 5);

function context({ current = '#8fb3ad', random = 0.1 } = {}): TerminalContext {
  return {
    now,
    music: createMockMusic({ now }),
    accent: {
      current: () => current,
      parseColour: (css) => canvas[css] ?? null,
      random: () => random,
    },
  };
}

const pairs = (line: Line) => line.map((span) => [span.text, span.tone ?? '']);

async function run(input: string, ctx = context()) {
  const result = await execute(input, ctx);
  return { lines: result.output?.lines.map(pairs), effects: result.effects, large: result.large, echo: result.echo };
}

describe('accent presets', () => {
  it.each([
    ['peach', '#e3a98b'],
    ['teal', '#8fb3ad'],
    ['lilac', '#c9a8d8'],
    ['gold', '#d8c48f'],
  ])('%s sets its preset colour as is, untuned', async (name, hex) => {
    expect(await run(`accent ${name}`)).toEqual({
      lines: [[[`accent → ${name}`, 'acc']]],
      effects: [{ type: 'set-accent', hex }],
      large: false,
      echo: `accent ${name}`,
    });
  });
});

/** `accent <input>` → [label, tuned hex], read off the board. */
async function tuned(input: string, ctx = context()) {
  const { lines, effects } = await run(`accent ${input}`, ctx);
  const [[label, labelTone], [hex, hexTone]] = lines![0]!;
  expect([labelTone, hexTone, lines!.length]).toEqual(['acc', 'dim', 1]);
  expect(hex).toMatch(/^  tuned #[0-9a-f]{6}$/);
  const tunedHex = hex!.slice('  tuned '.length);
  expect(effects).toEqual([{ type: 'set-accent', hex: tunedHex }]);
  return [label!.replace(/^accent → /, ''), tunedHex];
}

describe('accent hues', () => {
  it.each([
    ['30', 'hue 30', '#e6a599'],
    ['210deg', 'hue 210', '#77c6d4'],
    ['0', 'hue 0', '#e3a2b5'],
    ['0deg', 'hue 0', '#e3a2b5'],
    ['264', 'hue 264', '#9db7eb'],
    ['142', 'hue 142', '#9bc595'],
    ['12.5', 'hue 13', '#e6a3a9'],
    ['90.4deg', 'hue 90', '#cbb67b'],
    ['360', 'hue 360', '#e3a2b5'],
    ['360.0', 'hue 360', '#e3a2b5'],
  ])('%s is a hue at the palette lightness and chroma', async (input, label, hex) => {
    expect(await tuned(input)).toEqual([label, hex]);
  });

  it('reads 3-digit numbers above 360 as hex, as the board does', async () => {
    expect(await tuned('400')).toEqual(['400', '#e6a49a']); // #400, a dark red
    expect(await tuned('361')).toEqual(['361', '#a0c491']); // #361, a dark green
  });
});

describe('accent hex', () => {
  it.each([
    ['3af', '#8cbde8'],
    ['#3af', '#8cbde8'],
    ['abcdef', '#8fbce9'],
    ['#ABCDEF', '#8fbce9'],
    ['#0000ff', '#9eb7eb'],
  ])('%s is tuned (bare 3/6-digit hex allowed, case ignored)', async (input, hex) => {
    expect(await tuned(input)).toEqual([input.toLowerCase(), hex]);
  });
});

describe('accent CSS colours', () => {
  it.each([
    ['red', '#e6a49a'],
    ['RED', '#e6a49a'],
    ['navy', '#9eb7eb'],
    ['rgb(10,200,90)', '#93c69c'],
    ['rgb(255 0 0 / 50%)', '#e6a49a'],
    ['hsl(200 15% 50%)', '#80c2e1'],
    // The board reads the first three numbers of whatever the canvas returns, so an
    // oklch() colour comes out as if its numbers were rgb. Kept, for fidelity.
    ['oklch(0.7 0.2 30)', '#a1b6ec'],
  ])('%s is re-tuned to the palette', async (input, hex) => {
    expect(await tuned(input)).toEqual([input.toLowerCase(), hex]);
  });
});

describe('accent grays', () => {
  it.each(['gray', 'white', 'fff', 'transparent', 'hsl(200 5% 50%)', 'color(display-p3 1 0 0)'])(
    '%s (chroma under 0.02) becomes the warm neutral',
    async (input) => {
      expect(await tuned(input)).toEqual([`${input} (gray → warm neutral)`, '#c2bdb5']);
    },
  );
});

describe('accent random', () => {
  it('picks a whole hue from the random source', async () => {
    expect(await tuned('random', context({ random: 0.1 }))).toEqual(['hue 36', '#e5a694']);
    expect(await tuned('random', context({ random: 0.999 }))).toEqual(['hue 359', '#e3a2b6']);
    expect(await tuned('RANDOM', context({ random: 0 }))).toEqual(['hue 0', '#e3a2b5']);
  });
});

describe('accent gamut', () => {
  // At L 0.78 / C 0.08 every hue is inside sRGB (linear channels stay within
  // 0.18–0.84), so the chroma reduction never has to step in: even the most
  // saturated sources come out at the full palette chroma.
  it('keeps vivid sources at the full palette chroma, in gamut', async () => {
    expect(await tuned('#0000ff')).toEqual(['#0000ff', '#9eb7eb']);
    expect(await tuned('264')).toEqual(['hue 264', '#9db7eb']);
    expect(await tuned('rgb(10,200,90)')).toEqual(['rgb(10,200,90)', '#93c69c']);
  });
});

describe('accent invalid input', () => {
  it.each(['nope', '1234', '361deg', 'Dark  Red', '#12'])('%s explains what is accepted and changes nothing', async (input) => {
    const shown = input.split(/\s+/).join(' ');
    expect(await run(`accent ${input}`)).toMatchObject({
      lines: [[[`accent: not a color: ${shown}`, 'dim'], ['  · try red, #3af, 210 or random', 'dim']]],
      effects: [],
      large: false,
    });
  });
});

describe('accent with no value and reset', () => {
  it('prints usage and the current Accent', async () => {
    expect(await run('accent')).toEqual({
      lines: [[['accent: any css color, a hue 0–360, random or reset', 'dim']], [['now #8fb3ad', 'acc']]],
      effects: [],
      large: false,
      echo: 'accent',
    });
    expect((await run('accent', context({ current: '#e6a49a' }))).lines?.[1]).toEqual([['now #e6a49a', 'acc']]);
  });

  it('reset goes back to the default', async () => {
    expect(await run('accent Reset')).toEqual({
      lines: [[['accent → default', 'acc']]],
      effects: [{ type: 'clear-accent' }],
      large: false,
      echo: 'accent Reset',
    });
  });

  it('presets ignore case', async () => {
    expect((await run('ACCENT Teal')).effects).toEqual([{ type: 'set-accent', hex: '#8fb3ad' }]);
  });
});
