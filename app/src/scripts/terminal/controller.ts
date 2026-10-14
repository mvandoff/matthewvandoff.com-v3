/**
 * Terminal controller: browser wiring between the Terminal markup
 * (src/components/Terminal.astro) and the pure command module
 * (src/lib/terminal/commands.ts). It focuses the input on click, handles the keys,
 * renders results into #term-body, keeps the cursor and hint in step, toggles the
 * desktop expansion and applies effects.
 *
 * All wording comes from the command module or the Terminal's data-* attributes.
 */
import {
  complete,
  execute,
  History,
  listening,
  type Effect,
  type Line,
  type Listening,
  type Result,
  type Row,
  type TerminalContext,
} from '../../lib/terminal/commands.ts';
import { music } from '../../lib/music/index.ts';
import { goTo } from '../motion/scroll.ts';

const context: TerminalContext = { now: () => new Date(), music };

/** Fills the idle status's "listening" line (same markup as Terminal.astro renders). */
function renderListening(dd: HTMLElement, status: Listening): void {
  const nodes: Array<Node | string> = [];
  if (status.eq) {
    const eq = document.createElement('span');
    eq.className = 'eq';
    eq.setAttribute('aria-hidden', 'true');
    eq.append(...Array.from({ length: 4 }, () => document.createElement('i')));
    nodes.push(eq);
  }
  nodes.push(status.track);
  if (status.ago) {
    const ago = document.createElement('span');
    ago.className = 'ago';
    ago.textContent = status.ago;
    nodes.push(ago);
  }
  dd.replaceChildren(...nodes);
}

function renderLine(spans: Line): HTMLElement {
  const el = document.createElement('div');
  el.className = 't-ln';
  for (const span of spans) {
    const s = document.createElement('span');
    if (span.tone) s.className = `t-${span.tone}`;
    s.textContent = span.text;
    el.append(s);
  }
  return el;
}

function renderRow(row: Row): HTMLElement {
  const el = document.createElement('div');
  el.className = 't-row';
  const rank = document.createElement('span');
  rank.className = 't-dim';
  rank.textContent = row.rank;
  const name = document.createElement('span');
  name.className = 't-n';
  name.textContent = row.name;
  const bar = document.createElement('span');
  bar.className = 't-b';
  const fill = document.createElement('i');
  fill.style.width = `${row.pct}%`;
  bar.append(fill);
  const count = document.createElement('span');
  count.className = 't-c';
  count.textContent = row.count;
  el.append(rank, name, bar, count);
  return el;
}

function applyEffect(effect: Effect): void {
  switch (effect.type) {
    case 'scroll':
      goTo(effect.target);
      break;
  }
}

export function startTerminal(box = document.querySelector<HTMLElement>('[data-terminal]')): void {
  if (!box) return;
  const input = box.querySelector<HTMLInputElement>('#term-in');
  const body = box.querySelector<HTMLElement>('#term-body');
  const cmd = box.querySelector<HTMLElement>('.sig-cmd');
  const meta = box.querySelector<HTMLElement>('.sig-meta');
  const kana = box.querySelector<HTMLElement>('.sig-kana');
  const hint = box.querySelector<HTMLElement>('.t-hint');
  const cursor = box.querySelector<HTMLElement>('.cur');
  const leadCol = box.closest<HTMLElement>('.lead-col');
  if (!input || !body || !cmd || !meta || !kana || !hint || !cursor) return;

  const { prompt = '', idleCommand = '', hint: idleHint = '', closeHint = '' } = box.dataset;
  const idleStatus = [...body.childNodes];
  // The build rendered the listening line; refresh it from the music source so
  // it is current (a failing source keeps the built line).
  const listeningLine = body.querySelector<HTMLElement>('[data-listening]');
  if (listeningLine) {
    listening(context).then(
      (status) => renderListening(listeningLine, status),
      () => {},
    );
  }
  const history = new History();
  let showingOutput = false;
  /** Bumped on every run, Tab listing and Esc, so a stale async result is dropped. */
  let generation = 0;

  const syncChrome = () => {
    const focused = document.activeElement === input;
    cursor.hidden = focused || !!input.value;
    hint.textContent = showingOutput ? closeHint : input.value ? '' : idleHint;
  };

  const showBody = (lines: Line[] | null, rows: Row[] = []) => {
    if (lines) body.replaceChildren(...lines.map(renderLine), ...rows.map(renderRow));
    else body.replaceChildren(...idleStatus);
    showingOutput = !!lines;
    body.scrollTop = 0;
  };

  const showMeta = (text: string) => {
    meta.textContent = text;
    meta.hidden = !text;
    kana.hidden = !!text;
  };

  const render = (result: Result) => {
    showBody(result.output?.lines ?? null, result.output?.rows);
    cmd.textContent = `${prompt} ${result.echo || idleCommand}`;
    showMeta(result.meta);
    leadCol?.classList.toggle('xp', result.large);
    syncChrome();
  };

  const run = async () => {
    const raw = input.value;
    history.push(raw);
    input.value = '';
    syncChrome();
    const ticket = ++generation;
    const result = await execute(raw, context);
    if (ticket !== generation) return;
    render(result);
    result.effects.forEach(applyEffect);
  };

  const tab = () => {
    const completion = complete(input.value);
    if (!completion) return;
    if ('value' in completion) {
      input.value = completion.value;
    } else {
      // Listing options keeps the header echo and the expansion as they were.
      generation++;
      showBody(completion.lines);
      showMeta('');
    }
    syncChrome();
  };

  const recall = (value: string | null) => {
    if (value === null) return false;
    input.value = value;
    syncChrome();
    return true;
  };

  input.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        void run();
        break;
      case 'Tab':
        if (!input.value) return; // empty: Tab moves focus as usual
        event.preventDefault();
        tab();
        break;
      case 'ArrowUp':
        if (recall(history.up())) event.preventDefault();
        break;
      case 'ArrowDown':
        if (recall(history.down())) event.preventDefault();
        break;
      case 'Escape':
        generation++;
        input.value = '';
        render({ output: null, echo: '', meta: '', large: false, effects: [] });
        input.blur();
        break;
    }
  });
  input.addEventListener('input', syncChrome);
  input.addEventListener('focus', syncChrome);
  input.addEventListener('blur', syncChrome);

  box.addEventListener('click', () => {
    if (String(getSelection() ?? '').length || document.activeElement === input) return;
    input.focus();
  });
}
