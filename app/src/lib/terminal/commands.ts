/**
 * Terminal command module (pure, no DOM): execute, complete and history, per the
 * spec's "Modules" section. All Terminal output wording lives here. Unit-tested
 * with Vitest in tests/unit/terminal-commands.test.ts.
 *
 * Extension points for later tickets:
 *   mvd-034.4  music: add `top`, `np` and `recent` to `commands` (rows go in
 *              `Output.rows`; meta via `out(..., { meta })`) and a `music`
 *              field to `TerminalContext`.
 *   mvd-034.5  accent: add `accent` to `commands`, returning `set-accent` /
 *              `clear-accent` effects; add the current Accent and the injected
 *              CSS-colour parser to `TerminalContext`.
 * Both are already in `help` and in completion (`completions`), as designed.
 */

import { site } from '../content.ts';

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
export type ScrollTarget = 'top' | 'about' | 'experience' | 'links';

export type Effect =
  | { type: 'scroll'; target: ScrollTarget }
  | { type: 'set-accent'; hex: string }
  | { type: 'clear-accent' };

export interface Result {
  /** What the Terminal body shows; null = back to the idle status. */
  output: Output | null;
  /** Header command echo (raw trimmed input, case kept); '' = the idle command. */
  echo: string;
  /** Header meta label on the right; '' = show the kana instead. */
  meta: string;
  /** Large output expands the Terminal over the Name card on desktop. */
  large: boolean;
  effects: Effect[];
}

/** What commands may read from the outside world. */
export interface TerminalContext {
  /** The visitor's clock (`date`). */
  now(): Date;
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

const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length));

/** Output result. Large unless `large: false`. */
export const out = (
  call: Invocation,
  lines: Line[],
  { meta = '', rows = [] as Row[], large = true, effects = [] as Effect[] } = {},
): Result => ({ output: { lines, rows }, echo: call.input, meta, large, effects });

/** Small output: stays inside the Terminal. */
export const small = (call: Invocation, lines: Line[], effects: Effect[] = []): Result =>
  out(call, lines, { large: false, effects });

/** Back to the idle status. */
export const idle = (): Result => ({ output: null, echo: '', meta: '', large: false, effects: [] });

const help: Command = (call) =>
  out(call, [
    line([pad('top · np · recent', 34), 'acc'], ['music, via last.fm', 'dim']),
    line([pad('ls · cd <section>', 34), 'acc'], ['move around the page', 'dim']),
    line([pad('accent <color|hue|random>', 34), 'acc'], ['recolor the site', 'dim']),
    line([pad('whoami · date · clear', 34), 'acc'], ['tab completes · ↑ recalls', 'dim']),
  ]);

const ls: Command = (call) =>
  small(call, [line(['about/   experience/   links/', 'acc']), line(['cd <name> to jump there', 'dim'])]);

/** `cd` names (after dropping a trailing / and a leading ~/) and where they go. */
const cdTargets: Record<string, ScrollTarget> = {
  about: 'about',
  experience: 'experience',
  links: 'links',
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

const sudo: Command = (call) => small(call, [line(['nice try. this incident will be reported.', 'dim'])]);

/** Commands by lower-cased name, aliases included. */
export const commands: Record<string, Command> = {
  help,
  '?': help,
  ls,
  cd,
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
    cd: ['about', 'experience', 'links', 'home'],
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
