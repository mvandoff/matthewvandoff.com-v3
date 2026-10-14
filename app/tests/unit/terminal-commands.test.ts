import { describe, expect, it } from 'vitest';
import { createMockMusic } from '../../src/lib/music/mock.ts';
import { complete, execute, History, line, type Line, type TerminalContext } from '../../src/lib/terminal/commands.ts';

const now = () => new Date(2026, 9, 14, 9, 30, 5);
const ctx: TerminalContext = { now, music: createMockMusic({ now }) };

/** A line as `[text, tone]` pairs, tone '' when unstyled. */
const pairs = (line: Line) => line.map((span) => [span.text, span.tone ?? '']);

describe('help', () => {
  it('lists every command in four padded lines, as designed', async () => {
    const result = await execute('help', ctx);
    expect(result.output?.lines.map(pairs)).toEqual([
      [['top · np · recent                 ', 'acc'], ['music, via last.fm', 'dim']],
      [['ls · cd <section>                 ', 'acc'], ['move around the page', 'dim']],
      [['accent <color|hue|random>         ', 'acc'], ['recolor the site', 'dim']],
      [['whoami · date · clear             ', 'acc'], ['tab completes · ↑ recalls', 'dim']],
    ]);
    expect(result.output?.rows).toEqual([]);
    expect(result.large).toBe(true);
    expect(result.echo).toBe('help');
    expect(result.meta).toBe('');
    expect(result.effects).toEqual([]);
  });
});

describe('matching', () => {
  it('accepts ? as help and ignores case, echoing the input as typed', async () => {
    const help = await execute('help', ctx);
    for (const input of ['?', 'HELP', '  Help  ']) {
      const result = await execute(input, ctx);
      expect(result.output).toEqual(help.output);
      expect(result.echo).toBe(input.trim());
    }
  });

  it('replies to unknown commands with "command not found: x · try help", lower-cased', async () => {
    const result = await execute('Foo bar', ctx);
    expect(result.output?.lines.map(pairs)).toEqual([[['command not found: foo', ''], ['  · try help', 'dim']]]);
    expect(result.large).toBe(false);
    expect(result.echo).toBe('Foo bar');
  });

  it('treats an empty line as going back to the idle status', async () => {
    for (const input of ['', '   ']) {
      expect(await execute(input, ctx)).toEqual({ output: null, echo: '', meta: '', large: false, effects: [] });
    }
  });
});

describe('ls', () => {
  it('lists the Sections in small output', async () => {
    const result = await execute('ls', ctx);
    expect(result.output?.lines.map(pairs)).toEqual([
      [['about/   experience/   links/', 'acc']],
      [['cd <name> to jump there', 'dim']],
    ]);
    expect(result.large).toBe(false);
    expect(result.meta).toBe('');
  });
});

describe('whoami, date, sudo', () => {
  it('whoami prints the name and tagline', async () => {
    const result = await execute('whoami', ctx);
    expect(result.output?.lines.map(pairs)).toEqual([
      [['matthew van doff', 'acc']],
      [['software developer · for the information superhighway', 'dim']],
    ]);
    expect(result.large).toBe(false);
  });

  it("date prints the visitor's local date and time, lower-cased", async () => {
    const result = await execute('date', ctx);
    expect(result.output?.lines.map(pairs)).toEqual([[['wed oct 14 2026 09:30:05', '']]]);
    expect(result.large).toBe(false);
  });

  it('sudo gets the joke reply', async () => {
    const result = await execute('sudo rm -rf /', ctx);
    expect(result.output?.lines.map(pairs)).toEqual([[['nice try. this incident will be reported.', 'dim']]]);
    expect(result.large).toBe(false);
    expect(result.echo).toBe('sudo rm -rf /');
  });
});

describe('clear and its aliases', () => {
  it.each(['clear', 'cls', 'exit', 'status', 'cat', 'CAT status.txt'])('%s goes back to the idle status', async (input) => {
    expect(await execute(input, ctx)).toEqual({ output: null, echo: '', meta: '', large: false, effects: [] });
  });
});

describe('cd', () => {
  it.each([
    ['cd about', 'about', '→ ~/about'],
    ['cd experience', 'experience', '→ ~/experience'],
    ['cd links', 'links', '→ ~/links'],
    ['CD About', 'about', '→ ~/about'],
    ['cd experience/', 'experience', '→ ~/experience'],
    ['cd ~/links', 'links', '→ ~/links'],
    ['cd ~/about/', 'about', '→ ~/about'],
    ['cd ~links', 'links', '→ ~/links'],
    ['cd about extra', 'about', '→ ~/about'],
    ['cd home', 'top', '→ ~/home'],
    ['cd', 'top', '→ ~/home'],
    ['cd ..', 'top', '→ ~/home'],
    ['cd ../', 'top', '→ ~/home'],
    ['cd ~', 'top', '→ ~/home'],
    ['cd ~/', 'top', '→ ~/home'],
  ])('%s scrolls to %s', async (input, target, text) => {
    const result = await execute(input, ctx);
    expect(result.output?.lines.map(pairs)).toEqual([[[text, 'acc']]]);
    expect(result.effects).toEqual([{ type: 'scroll', target }]);
    expect(result.large).toBe(false);
    expect(result.echo).toBe(input);
  });

  it.each([
    ['cd nowhere', 'nowhere'],
    ['cd Work/', 'work'],
    ['cd ~/resume', 'resume'],
    ['cd top', 'top'],
    ['cd ../..', '../..'],
  ])('%s has no such section', async (input, name) => {
    const result = await execute(input, ctx);
    expect(result.output?.lines.map(pairs)).toEqual([[[`cd: no such section: ${name}`, 'dim']]]);
    expect(result.effects).toEqual([]);
    expect(result.large).toBe(false);
  });
});

describe('complete', () => {
  it.each([
    ['h', 'help '],
    ['TO', 'top '],
    ['r', 'recent '],
    ['a', 'accent '],
    ['wh', 'whoami '],
    ['top ar', 'top artists '],
    ['top tracks --w', 'top tracks --week '],
    ['cd ex', 'cd experience '],
    ['CD Li', 'CD links '],
    ['accent l', 'accent lilac '],
    ['accent re', 'accent reset '],
  ])('completes a single match: %s → "%s"', (input, value) => {
    expect(complete(input)).toEqual({ value });
  });

  it('completes the shared prefix of several matches, with no trailing space', () => {
    expect(complete('top -')).toEqual({ value: 'top --' });
  });

  it.each([
    ['c', ['cd', 'clear']],
    ['top a', ['artists', 'albums']],
    ['top --', ['--week', '--month', '--year', '--all']],
    ['accent r', ['random', 'reset']],
    ['cd ', ['about', 'experience', 'links', 'home']],
    ['top ', ['artists', 'tracks', 'albums', '--week', '--month', '--year', '--all']],
    ['accent ', ['peach', 'teal', 'lilac', 'gold', 'random', 'reset']],
  ])('lists the options when no longer prefix is shared: %s', (input, options) => {
    expect(complete(input)).toEqual({ options, lines: [line([options.join('   '), 'dim'])] });
  });

  it('only completes the designed commands: no aliases, sudo or clear-likes', () => {
    expect(complete('?')).toBeNull();
    expect(complete('s')).toBeNull();
    expect(complete('e')).toBeNull();
    expect(complete('cl')).toEqual({ value: 'clear ' });
  });

  it('does nothing without a match or for commands without arguments', () => {
    expect(complete('')).toBeNull();
    expect(complete('xyz')).toBeNull();
    expect(complete('ls a')).toBeNull();
    expect(complete('cd zz')).toBeNull();
  });
});

describe('History', () => {
  const recall = (history: History, keys: Array<'up' | 'down'>) => keys.map((key) => history[key]());

  it('does nothing until something has run', () => {
    const history = new History();
    expect(history.up()).toBeNull();
    expect(history.down()).toBeNull();
  });

  it('↑ walks back to the oldest and stays there; ↓ walks forward and ends on an empty input', () => {
    const history = new History();
    for (const cmd of ['help', 'ls', 'date']) history.push(cmd);
    expect(recall(history, ['up', 'up', 'up', 'up'])).toEqual(['date', 'ls', 'help', 'help']);
    expect(recall(history, ['down', 'down', 'down', 'down'])).toEqual(['ls', 'date', '', '']);
  });

  it('stores back-to-back repeats once, trimmed, and skips empty input', () => {
    const history = new History();
    for (const cmd of ['ls', 'ls', ' ls ', '', '   ', 'date', 'ls']) history.push(cmd);
    expect(recall(history, ['up', 'up', 'up', 'up'])).toEqual(['ls', 'date', 'ls', 'ls']);
  });

  it('keeps the last 30 commands', () => {
    const history = new History();
    for (let i = 1; i <= 35; i++) history.push(`cmd ${i}`);
    const recalled = recall(history, Array<'up'>(31).fill('up'));
    expect(recalled[0]).toBe('cmd 35');
    expect(recalled[29]).toBe('cmd 6');
    expect(recalled[30]).toBe('cmd 6');
  });

  it('running a command (even an empty one) starts recall from the newest again', () => {
    const history = new History();
    for (const cmd of ['help', 'ls', 'date']) history.push(cmd);
    history.up();
    history.up();
    history.push('');
    expect(history.up()).toBe('date');
    history.push('whoami');
    expect(history.up()).toBe('whoami');
  });
});
