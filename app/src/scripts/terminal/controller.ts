/**
 * Terminal controller: browser wiring between the Terminal markup
 * (src/components/Terminal.astro) and the pure command module
 * (src/lib/terminal/commands.ts). It focuses the input on landing and on click, handles the keys,
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
import { clearAccent, currentAccent, parseColour, setAccent } from '../accent-store.ts';

const context: TerminalContext = {
  now: () => new Date(),
  music,
  accent: { current: currentAccent, parseColour, random: () => Math.random() },
};

/**
 * How often the listening line rereads the music data while the page is visible:
 * the recent file's max-age (RECENT_CACHE in fetcher/handler.ts), so each read can
 * see a newer file.
 */
const LISTENING_REFRESH_MS = 30_000;

/** Runs `refresh` now and every `ms` while the page is visible. A hidden page makes no requests, and refreshes as soon as it is shown again. */
function whileVisible(refresh: () => void, ms: number): void {
  let timer: ReturnType<typeof setInterval> | undefined;
  const sync = () => {
    clearInterval(timer);
    timer = undefined;
    if (document.visibilityState !== 'visible') return;
    refresh();
    timer = setInterval(refresh, ms);
  };
  document.addEventListener('visibilitychange', sync);
  sync();
}

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
    case 'set-accent':
      setAccent(effect.hex);
      break;
    case 'clear-accent':
      clearAccent();
      break;
    default:
      effect satisfies never;
  }
}

/**
 * Focuses the input once the page has landed so a visitor can type straight away.
 * Only where a keyboard is likely (a fine, hovering pointer: on touch it would raise
 * the on-screen keyboard), never over a deep link (#hash) and never when the visitor
 * has already focused something. Waits out the Boot, which covers the page.
 */
function focusOnLanding(input: HTMLInputElement): void {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const root = document.documentElement;
  const focus = () => {
    if (location.hash || document.activeElement !== document.body) return;
    input.focus({ preventScroll: true });
  };
  if (!root.classList.contains('booting')) {
    focus();
    return;
  }
  const watch = new MutationObserver(() => {
    if (root.classList.contains('booting')) return;
    watch.disconnect();
    focus();
  });
  watch.observe(root, { attributes: true, attributeFilter: ['class'] });
}

export function startTerminal(box = document.querySelector<HTMLElement>('[data-terminal]')): void {
  if (!box) return;
  const input = box.querySelector<HTMLInputElement>('#term-in');
  const body = box.querySelector<HTMLElement>('#term-body');
  const cmd = box.querySelector<HTMLElement>('.sig-cmd');
  const meta = box.querySelector<HTMLElement>('.sig-meta');
  const kana = box.querySelector<HTMLElement>('.sig-kana');
  const art = box.querySelector<HTMLButtonElement>('.sig-art');
  const artImg = art?.querySelector('img');
  const dialog = box.querySelector<HTMLDialogElement>('.art-dialog');
  const hint = box.querySelector<HTMLElement>('.t-hint');
  const cursor = box.querySelector<HTMLElement>('.cur');
  const leadCol = box.closest<HTMLElement>('.lead-col');
  if (!input || !body || !cmd || !meta || !kana || !art || !artImg || !dialog || !hint || !cursor) return;

  const { prompt = '', idleCommand = '', hint: idleHint = '', closeHint = '' } = box.dataset;
  const idleStatus = [...body.childNodes];
  // The build rendered the listening line as a placeholder; it is filled from the
  // music source once the Terminal is wired up (a failing source keeps the placeholder).
  const listeningLine = body.querySelector<HTMLElement>('[data-listening]');
  /** Whether the album art loaded; until then, and if it fails, the header shows its kana. */
  let artLoaded = false;
  const setArtLoaded = (loaded: boolean) => {
    artLoaded = loaded;
    showMeta(meta.hidden ? undefined : meta.textContent ?? undefined);
  };
  artImg.addEventListener('load', () => setArtLoaded(true));
  artImg.addEventListener('error', () => setArtLoaded(false));

  const [fullImg, artCap] = [dialog.querySelector('img'), dialog.querySelector('.art-cap')];
  /** The art in the header, which the dialog shows full size. */
  let shownArt: Listening['art'];
  /** Shows the thumbnail in the dialog until the full size arrives. */
  const loadFull = ({ thumb, full }: NonNullable<Listening['art']>) => {
    if (!fullImg) return;
    fullImg.src = thumb;
    const loader = new Image();
    loader.onload = () => {
      if (shownArt?.full === full) fullImg.src = full;
    };
    loader.src = full;
  };
  /** Starts loading the full size once per art, on the first sign of a click, so it's often ready when the dialog opens. */
  const primeFull = () => {
    if (shownArt && fullImg && !fullImg.src) loadFull(shownArt);
  };
  for (const intent of ['pointerenter', 'focus', 'pointerdown']) art.addEventListener(intent, primeFull);
  art.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!shownArt) return;
    primeFull();
    dialog.showModal();
  });
  // A click on the backdrop (the dialog itself, outside its content) closes it.
  dialog.addEventListener('click', (event) => {
    event.stopPropagation();
    if (event.target === dialog) dialog.close();
  });
  // The dialog hands focus back to the art. Closed with the pointer, it goes to the input
  // instead, as any other click on the Terminal does; closed from the keyboard, it stays.
  let pointerClose = false;
  dialog.addEventListener('pointerdown', () => (pointerClose = true));
  dialog.addEventListener('keydown', () => (pointerClose = false));
  dialog.addEventListener('close', () => {
    if (pointerClose) input.focus();
    pointerClose = false;
  });
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

  /** The header's right side: the meta label if any, else the album art once loaded, else the kana. */
  const showMeta = (text?: string) => {
    meta.textContent = text ?? '';
    meta.hidden = !text;
    art.hidden = !!text || !artLoaded;
    kana.hidden = !!text || artLoaded;
  };

  /** Swaps the header thumbnail and readies the dialog. With no art, the header shows its kana. */
  const showArt = (next: Listening['art']) => {
    if (next?.thumb === shownArt?.thumb && next?.caption === shownArt?.caption) return;
    shownArt = next;
    fullImg?.removeAttribute('src');
    if (!next) {
      artImg.removeAttribute('src');
      setArtLoaded(false);
      dialog.close();
      return;
    }
    // The old thumbnail stays up until the new one loads; if it fails, the kana shows.
    artImg.src = next.thumb;
    art.setAttribute('aria-label', `${art.dataset.label ?? ''} ${next.caption}`);
    if (fullImg) fullImg.alt = next.caption;
    if (artCap) artCap.textContent = next.caption;
    if (dialog.open) loadFull(next);
  };

  /** What the listening line last rendered, so an unchanged read leaves it (and its EQ) alone. */
  let shownListening = '';
  /** Bumped on every read, so a slow read can't overwrite a newer one. */
  let listeningTicket = 0;
  const refreshListening = async () => {
    if (!listeningLine) return;
    const ticket = ++listeningTicket;
    const status = await listening(context).catch(() => null);
    if (!status || ticket !== listeningTicket) return;
    const key = JSON.stringify([status.track, status.ago, status.eq]);
    if (key !== shownListening) {
      renderListening(listeningLine, status);
      shownListening = key;
    }
    showArt(status.art);
  };
  whileVisible(() => void refreshListening(), LISTENING_REFRESH_MS);

  const render = (result: Result) => {
    showBody(result.output?.lines ?? null, result.output?.rows);
    cmd.textContent = `${prompt} ${result.echo ?? idleCommand}`;
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
      showMeta();
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
        // First Esc closes whatever is showing and keeps focus for the next command;
        // Esc on an idle, empty Terminal lets go of focus.
        if (showingOutput || input.value) {
          generation++;
          input.value = '';
          render({ output: null, large: false, effects: [] });
        } else {
          input.blur();
        }
        break;
    }
  });
  input.addEventListener('input', syncChrome);
  input.addEventListener('focus', syncChrome);
  input.addEventListener('blur', syncChrome);

  focusOnLanding(input);

  box.addEventListener('click', () => {
    if (String(getSelection() ?? '').length || document.activeElement === input) return;
    input.focus();
  });
}
