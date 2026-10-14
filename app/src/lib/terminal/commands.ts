/**
 * Terminal command module (pure, no DOM): execute, complete and history, per the
 * spec's "Modules" section. All Terminal output wording lives here. Unit-tested
 * with Vitest in tests/unit/terminal-commands.test.ts and terminal-music.test.ts.
 *
 * Music (`top`, `np`, `recent` and the idle `listening` line) reads only the
 * `MusicSource` in the context, so another source needs no changes here.
 *
 * `accent` reads the current Accent and the browser's CSS-colour parsing from the
 * context and returns `set-accent` / `clear-accent` effects; the controller hands
 * those to the Accent store. Tuning itself is in ../accent.ts.
 */

import { site, type SectionId } from '../content.ts';
import { zeroPad } from '../format.ts';
import type { MusicSource, Period, TopKind } from '../music/source.ts';
import { accentPresets, tune, type ColourParser } from '../accent.ts';

/** Colour of a span: Accent, dim, or the second (artist) colour. Unset = ink-2. */
export type Tone = 'acc' | 'dim' | 'tl';

export interface Span {
  text: string;
  tone?: Tone;
}

/** One output line: styled spans, rendered on one unwrapped row. */
export type Line = Span[];

/** One ranked bar row (the `top` command). `pct` is the bar width, 4–100. */
export interface Row {
  rank: string;
  name: string;
  pct: number;
  count: string;
}

export interface Output {
  lines: Line[];
  rows: Row[];
}

/** Where `cd` (and later the Motion controller) can send the page. `top` = home. */
export type ScrollTarget = 'top' | SectionId;

/** Every ScrollTarget, `top` first then the Sections in page order. */
export const scrollTargets: readonly ScrollTarget[] = ['top', ...site.sections.map((section) => section.id)];

export type Effect =
  | { type: 'scroll'; target: ScrollTarget }
  | { type: 'set-accent'; hex: string }
  | { type: 'clear-accent' };

export interface Result {
  /** What the Terminal body shows; null = back to the idle status. */
  output: Output | null;
  /** Header command echo (raw trimmed input, case kept); absent = the idle command. */
  echo?: string;
  /** Header meta label on the right; absent = show the kana instead. */
  meta?: string;
  /** Large output expands the Terminal over the Name card on desktop. */
  large: boolean;
  effects: Effect[];
}

/** What commands may read from the outside world. */
export interface TerminalContext {
  /** The visitor's clock (`date`, and relative times for music). */
  now(): Date;
  /** Where `top`, `np` and `recent` read listening data. */
  music: MusicSource;
  accent: {
    /** The Accent in use: the visitor's override, else the default. */
    current(): string;
    /** The browser's CSS-colour parsing (see ColourParser). */
    parseColour: ColourParser;
    /** 0 ≤ x < 1, for `accent random`. */
    random(): number;
  };
}

/** A parsed input line, as handed to each command. */
export interface Invocation {
  /** The raw trimmed input, case kept (the header echo). */
  input: string;
  /** Arguments, lower-cased. */
  args: string[];
  /** Arguments as typed. */
  rawArgs: string[];
}

export type Command = (call: Invocation, ctx: TerminalContext) => Result | Promise<Result>;

/** Builds a line from `[text, tone?]` pairs. */
export const line = (...parts: Array<[string, Tone?]>): Line =>
  parts.map(([text, tone]) => (tone ? { text, tone } : { text }));

/** Output result. Large unless `large: false`. */
export const out = (
  call: Invocation,
  lines: Line[],
  { meta, rows = [] as Row[], large = true, effects = [] as Effect[] }: { meta?: string; rows?: Row[]; large?: boolean; effects?: Effect[] } = {},
): Result => ({ output: { lines, rows }, echo: call.input, meta, large, effects });

/** Small output: stays inside the Terminal. */
export const small = (call: Invocation, lines: Line[], effects: Effect[] = []): Result =>
  out(call, lines, { large: false, effects });

/** Back to the idle status. */
export const idle = (): Result => ({ output: null, large: false, effects: [] });

const help: Command = (call) =>
  out(call, [
    line(['top · np · recent'.padEnd(34), 'acc'], ['music, via last.fm', 'dim']),
    line(['ls · cd <section>'.padEnd(34), 'acc'], ['move around the page', 'dim']),
    line(['accent <color|hue|random>'.padEnd(34), 'acc'], ['recolor the site', 'dim']),
    line(['whoami · date · clear'.padEnd(34), 'acc'], ['tab completes · ↑ recalls', 'dim']),
  ]);

const ls: Command = (call) =>
  small(call, [
    line([site.sections.map((section) => `${section.label}/`).join('   '), 'acc']),
    line(['cd <name> to jump there', 'dim']),
  ]);

/** `cd` names (after dropping a trailing / and a leading ~/) and where they go. */
const cdTargets: Record<string, ScrollTarget> = {
  ...Object.fromEntries(site.sections.map((section) => [section.id, section.id])),
  home: 'top',
  '': 'top',
  '..': 'top',
};

const cd: Command = (call) => {
  const name = (call.args[0] ?? '').replace(/\/$/, '').replace(/^~\/?/, '');
  const target = Object.hasOwn(cdTargets, name) ? cdTargets[name] : undefined;
  if (!target) return small(call, [line([`cd: no such section: ${name}`, 'dim'])]);
  const shown = target === 'top' ? 'home' : name;
  return small(call, [line([`→ ~/${shown}`, 'acc'])], [{ type: 'scroll', target }]);
};

const whoami: Command = (call) =>
  small(call, [
    line([site.nameCard.nameLines.join(' '), 'acc']),
    line([`${site.nameCard.role} · ${site.nameCard.tagline}`, 'dim']),
  ]);

const date: Command = (call, ctx) => small(call, [line([ctx.now().toString().toLowerCase().slice(0, 24)])]);

/** `top` periods: the meta label for each. */
const periodLabels: Record<Period, string> = {
  week: '7 days',
  month: '30 days',
  year: '12 months',
  all: 'all time',
};

/** Meta suffix for placeholder data. */
const mockLabel = (mock: boolean) => (mock ? ' · mock data' : '');

/**
 * `top [artists|tracks|albums] [--week|--month|--year|--all]`, as on the board:
 * the words may come in any order and anything else is ignored; tracks beat
 * albums beat artists, --week beats --month beats --all; otherwise 12 months.
 */
const top: Command = async (call, ctx) => {
  const has = (word: string) => call.args.includes(word);
  const kind: TopKind = has('tracks') ? 'tracks' : has('albums') ? 'albums' : 'artists';
  const period: Period = has('--week') ? 'week' : has('--month') ? 'month' : has('--all') ? 'all' : 'year';
  const list = await ctx.music.top(kind, period);
  const items = list.items.slice(0, 10);
  const max = items[0]?.plays || 1;
  const rows = items.map(
    (item, i): Row => ({
      rank: zeroPad(i + 1),
      name: item.artist ? `${item.name} — ${item.artist}` : item.name,
      pct: Math.max(4, Math.round((item.plays / max) * 100)),
      count: String(Math.max(1, Math.round(item.plays))),
    }),
  );
  return out(call, [], { meta: `top ${kind} · ${periodLabels[period]}${mockLabel(list.mock)}`, rows });
};

/**
 * How long ago `at` was, in the Terminal's short form: whole minutes under an
 * hour (`4m`), whole hours under a day (`2h`), then days (`3d`).
 */
export function ago(at: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

const np: Command = async (call, ctx) => {
  const np = await ctx.music.nowPlaying();
  const { title, artist, album } = np.track;
  const when = ago(np.at, ctx.now());
  const lines = np.playing
    ? [
        line(['▶ ', 'acc'], [`${title} — ${artist}`]),
        line([`  ${album ? `on ${album} · ` : ''}started ${when} ago`, 'dim']),
      ]
    : [
        line(['■ ', 'dim'], [`${title} — ${artist}`]),
        line([`  last played ${when} ago · nothing on right now`, 'dim']),
      ];
  return out(call, lines, { meta: `last.fm${mockLabel(np.mock)}` });
};

/** The idle status's "listening" line: the track, the trailing time, and whether the EQ shows. */
export interface Listening {
  track: string;
  /** ' · 2h ago' when last played; '' while playing. */
  ago: string;
  /** The animated EQ bars, shown only while playing. */
  eq: boolean;
}

export async function listening(ctx: Pick<TerminalContext, 'now' | 'music'>): Promise<Listening> {
  const np = await ctx.music.nowPlaying();
  return {
    track: `${np.track.title} — ${np.track.artist}`,
    ago: np.playing ? '' : ` · ${ago(np.at, ctx.now())} ago`,
    eq: np.playing,
  };
}

const recent: Command = async (call, ctx) => {
  const recent = await ctx.music.recent();
  const now = ctx.now();
  const lines = recent.tracks.slice(0, 10).map(({ track, playing, at }) =>
    line(
      playing ? ['now'.padEnd(5), 'acc'] : [ago(at, now).padEnd(5), 'dim'],
      [`${track.title} — `],
      [track.artist, 'tl'],
    ),
  );
  return out(call, lines, { meta: `last.fm${mockLabel(recent.mock)}` });
};

/**
 * `accent [value]`: no value prints usage and the current Accent; `reset` goes
 * back to the default; presets are set as is; anything else is tuned.
 */
const accent: Command = (call, ctx) => {
  const raw = call.rawArgs.join(' ');
  const n = raw.toLowerCase();
  if (!n) {
    return small(call, [
      line(['accent: any css color, a hue 0–360, random or reset', 'dim']),
      line([`now ${ctx.accent.current()}`, 'acc']),
    ]);
  }
  if (n === 'reset') return small(call, [line(['accent → default', 'acc'])], [{ type: 'clear-accent' }]);
  const preset = Object.hasOwn(accentPresets, n) ? accentPresets[n] : undefined;
  if (preset) return small(call, [line([`accent → ${n}`, 'acc'])], [{ type: 'set-accent', hex: preset }]);
  const tuned = tune(n, ctx.accent);
  if (!tuned) {
    return small(call, [line([`accent: not a color: ${raw}`, 'dim'], ['  · try red, #3af, 210 or random', 'dim'])]);
  }
  return small(
    call,
    [line([`accent → ${tuned.label}`, 'acc'], [`  tuned ${tuned.hex}`, 'dim'])],
    [{ type: 'set-accent', hex: tuned.hex }],
  );
};

const sudo: Command = (call) => small(call, [line(['nice try. this incident will be reported.', 'dim'])]);

/** Commands by lower-cased name, aliases included. */
export const commands: Record<string, Command> = {
  help,
  '?': help,
  top,
  np,
  recent,
  ls,
  cd,
  accent,
  whoami,
  date,
  sudo,
  clear: idle,
  cls: idle,
  exit: idle,
  status: idle,
  cat: idle,
};

/** Runs one line of input. Commands are matched case-insensitively. */
export async function execute(raw: string, ctx: TerminalContext): Promise<Result> {
  const input = raw.trim();
  const words = input.split(/\s+/).filter(Boolean);
  const name = (words[0] ?? '').toLowerCase();
  if (!name) return idle();
  const rawArgs = words.slice(1);
  const call: Invocation = { input, args: rawArgs.map((a) => a.toLowerCase()), rawArgs };
  const command = Object.hasOwn(commands, name) ? commands[name] : undefined;
  if (command) return command(call, ctx);
  return small(call, [line(['command not found: ' + name], ['  · try help', 'dim'])]);
}

/**
 * What Tab completes: the top-level commands (aliases, `sudo` and the clear-likes
 * deliberately left out, as designed), then the arguments of these commands.
 */
export const completions = {
  commands: ['help', 'top', 'np', 'recent', 'ls', 'cd', 'accent', 'whoami', 'date', 'clear'],
  args: {
    top: ['artists', 'tracks', 'albums', '--week', '--month', '--year', '--all'],
    cd: [...site.sections.map((section) => section.id), 'home'],
    accent: ['peach', 'teal', 'lilac', 'gold', 'random', 'reset'],
  } as Record<string, string[]>,
};

/**
 * Tab completion: a new input value, or the options to list (as one dim line).
 * null = nothing to do. Never called with empty input (Tab then moves focus).
 */
export type Completion = { value: string } | { options: string[]; lines: Line[] } | null;

export function complete(value: string): Completion {
  if (!value) return null;
  const words = value.split(/\s+/);
  const head = (words[0] ?? '').toLowerCase();
  const pool = words.length <= 1 ? completions.commands : (completions.args[head] ?? []);
  const last = (words.at(-1) ?? '').toLowerCase();
  const matches = pool.filter((option) => option.startsWith(last));
  if (!matches.length) return null;
  if (matches.length === 1) {
    words[words.length - 1] = matches[0]!;
    return { value: words.join(' ') + ' ' };
  }
  let prefix = matches[0]!;
  for (const option of matches) while (!option.startsWith(prefix)) prefix = prefix.slice(0, -1);
  if (prefix.length > last.length) {
    words[words.length - 1] = prefix;
    return { value: words.join(' ') };
  }
  return { options: matches, lines: [line([matches.join('   '), 'dim'])] };
}

/**
 * Command history for ↑/↓: the last `limit` commands, back-to-back repeats
 * stored once. `up`/`down` return the input value to show, or null when there is
 * no history yet (the keys then do nothing).
 */
export class History {
  readonly limit: number;
  #entries: string[] = [];
  #cursor = 0;

  constructor(limit = 30) {
    this.limit = limit;
  }

  /** Records a run command and resets recall to start from the newest. */
  push(input: string): void {
    const cmd = input.trim();
    if (cmd && this.#entries.at(-1) !== cmd) this.#entries = [...this.#entries, cmd].slice(-this.limit);
    this.#cursor = this.#entries.length;
  }

  up(): string | null {
    if (!this.#entries.length) return null;
    this.#cursor = Math.max(0, this.#cursor - 1);
    return this.#entries[this.#cursor]!;
  }

  down(): string | null {
    if (!this.#entries.length) return null;
    this.#cursor = Math.min(this.#entries.length, this.#cursor + 1);
    return this.#entries[this.#cursor] ?? '';
  }
}
