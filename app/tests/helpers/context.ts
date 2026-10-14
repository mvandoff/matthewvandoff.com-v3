import type { TerminalContext } from '../../src/lib/terminal/commands.ts';

/** A TerminalContext `accent` for tests that don't exercise it: teal, no CSS colours. */
export const noAccent: TerminalContext['accent'] = {
  current: () => '#8fb3ad',
  parseColour: () => null,
  random: () => 0,
};
