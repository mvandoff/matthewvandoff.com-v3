import { expect, test, type Page } from '@playwright/test';
import { open } from './board.ts';

/**
 * Navigation and scroll against the live board: the same clicks and scrolls on
 * both sides must give the same header state (prompt, border, progress line),
 * the same reveal states and transitions, and the same Lock-on (timing, look and
 * placement), with and without reduced motion.
 *
 * Deliberate differences, carved out below:
 * - Under reduced motion the board still draws the heading rule in with a
 *   transition; the spec says no reveal, so the site's rule is simply drawn.
 * - The board's scrollIntoView lands up to 32px short of a Section that hasn't
 *   been revealed yet; the site lands on it. The flows here avoid that case
 *   (tests/e2e/navigation.spec.ts covers the site's landing).
 */

test.use({ viewport: { width: 1440, height: 900 } });

type Snapshot = Record<string, unknown>;

/** Header, Sections and every visible Lock-on part, as computed styles and boxes. */
const snapshot = (page: Page) =>
  page.evaluate(() => {
    const out: Record<string, unknown> = {};
    const bar = document.querySelector('header')!;
    out['header'] = {
      down: bar.classList.contains('down'),
      border: getComputedStyle(bar).borderBottomColor,
      prompt: bar.querySelector('.prompt')!.textContent,
      progress: getComputedStyle(bar.querySelector('.prog')!).transform,
    };
    for (const id of ['about', 'experience', 'links']) {
      const el = document.getElementById(id)!;
      const s = getComputedStyle(el);
      const rule = getComputedStyle(el.querySelector('.sh-r')!, '::after');
      out[id] = {
        opacity: s.opacity,
        transform: s.transform,
        transition: s.transition,
        rule: rule.transform,
        ruleTransition: rule.transition,
      };
    }
    // Lock-on parts, placed relative to the element hosting them.
    const parts = [...document.querySelectorAll<HTMLElement>('.lock, .locktag')].filter(
      (el) => getComputedStyle(el).display !== 'none',
    );
    out['lock'] = parts.map((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const h = el.parentElement!.getBoundingClientRect();
      return {
        where: el.closest('section')?.id ?? 'home',
        part: el.className,
        text: el.textContent,
        box: [r.x - h.x, r.y - h.y, r.width, r.height].map((v) => Math.round(v * 4) / 4),
        border: s.borderTopColor + ' ' + s.borderTopWidth + ' ' + s.borderTopStyle,
        background: s.backgroundColor,
        color: s.color,
        font: s.fontSize + ' ' + s.letterSpacing + ' ' + s.fontFamily,
        animation: s.animation,
      };
    });
    return out;
  });

/** Every running transition finishes, so a snapshot reads the end state. */
const finishTransitions = (page: Page) =>
  page.evaluate(() => {
    for (const a of document.getAnimations()) if (!(a as CSSAnimation).animationName) a.finish();
  });

/** Lock-on animations seeked to `t` ms, so their boxes compare at the same instant. */
const seekLock = (page: Page, t: number) =>
  page.evaluate((ms) => {
    for (const a of document.getAnimations()) {
      if (['lockbox', 'locktag'].includes((a as CSSAnimation).animationName)) {
        a.pause();
        a.currentTime = ms;
      }
    }
  }, t);

/** Scrolls and lets the (rAF-throttled, fake-clock) scroll tracking catch up. */
async function scrollTo(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  const expected = await page.evaluate(() => {
    const span = document.documentElement.scrollHeight - innerHeight;
    return Math.min(1, Math.max(0, scrollY / span)) || 0;
  });
  await expect
    .poll(async () => {
      await page.clock.runFor(20);
      const sp = await page.evaluate(() => document.documentElement.style.getPropertyValue('--sp'));
      return Math.abs(Number(sp) - expected) < 0.00015;
    })
    .toBe(true);
}

/** Waits (in real time, the fake clock untouched) for a smooth scroll away from `from` to come to rest. */
async function scrollSettles(page: Page, from: number) {
  await expect.poll(() => page.evaluate(() => scrollY)).not.toBe(from);
  let last = -1;
  await expect
    .poll(
      async () => {
        const y = await page.evaluate(() => scrollY);
        const still = y === last;
        last = y;
        return still;
      },
      { intervals: [150] },
    )
    .toBe(true);
}

/** Navigates with `act`, then records the Lock-on before, at and after its window. */
async function lockOn(page: Page, states: Record<string, Snapshot>, label: string, act: () => Promise<void>) {
  const from = await page.evaluate(() => scrollY);
  await act();
  await scrollSettles(page, from);
  states[`${label}: scrollY`] = { y: await page.evaluate(() => Math.round(scrollY)) };
  await page.clock.runFor(640);
  states[`${label}: 640ms, no lock yet`] = { lock: (await snapshot(page))['lock'] };
  await page.clock.runFor(20);
  for (const t of [0, 400, 800, 1200]) {
    await seekLock(page, t);
    states[`${label}: lock at +${t}ms`] = { lock: (await snapshot(page))['lock'] };
  }
  await page.clock.runFor(1600);
  states[`${label}: 2260ms, lock gone`] = { lock: (await snapshot(page))['lock'] };
}

/** The same clicks and scrolls on one side; returns a snapshot per step. */
async function drive(page: Page) {
  const states: Record<string, Snapshot> = {};
  await page.clock.runFor(4000); // past the entrance
  await page.evaluate(() => document.fonts.ready);
  await page.clock.runFor(20);
  await finishTransitions(page);
  states['at load'] = await snapshot(page);

  for (const y of [8, 9, 700, 1350, 1700, 99_999]) {
    await scrollTo(page, y);
    if (y === 700) {
      // Experience is revealed here: compare the transitions that start (their progress
      // depends on real time, so only what runs and how).
      states['revealing experience'] = {
        transitions: await page.locator('#experience').evaluate((el) =>
          el
            .getAnimations({ subtree: true })
            .map((a) => {
              const t = (a.effect as KeyframeEffect).getTiming();
              const pseudo = (a.effect as KeyframeEffect).pseudoElement ?? '';
              return `${(a as CSSTransition).transitionProperty}${pseudo} ${t.duration}ms ${t.delay}ms ${t.easing}`;
            })
            .sort(),
        ),
      };
    }
    await finishTransitions(page);
    states[`scrolled to ${y}`] = await snapshot(page);
  }

  await lockOn(page, states, '[ mvd ] from the bottom', () => page.locator('header a[href="#top"]').click());
  await lockOn(page, states, 'about Cel', () => page.locator('a.cel[href="#about"]').click());
  await lockOn(page, states, 'cd links', async () => {
    await page.locator('#term-in').fill('cd links');
    await page.locator('#term-in').press('Enter');
  });
  await lockOn(page, states, 'back to top', () => page.locator('#foot a[href="#top"]').click());
  return states;
}

test('header, reveal and Lock-on match the board', async ({ browser }) => {
  const site = await drive(await open(browser, 'site'));
  const board = await drive(await open(browser, 'board'));
  expect(Object.keys(site)).toEqual(Object.keys(board));
  for (const label of Object.keys(board)) expect.soft(site[label], label).toEqual(board[label]);
});

test('with reduced motion: instant jumps, no Lock-on, Sections simply there', async ({ browser }) => {
  const site = await drive(await open(browser, 'site', { reduced: true }));
  const board = await drive(await open(browser, 'board', { reduced: true }));
  // The board still transitions the heading rule here; the site draws it outright.
  const withoutRule = (s: Snapshot) =>
    Object.fromEntries(
      Object.entries(s).map(([k, v]) =>
        ['about', 'experience', 'links'].includes(k) ? [k, { ...(v as Snapshot), rule: '-', ruleTransition: '-' }] : [k, v],
      ),
    );
  for (const label of Object.keys(board)) {
    if (label === 'revealing experience') continue;
    expect.soft(withoutRule(site[label]!), label).toEqual(withoutRule(board[label]!));
    for (const id of ['about', 'experience', 'links']) {
      const section = site[label]?.[id] as Snapshot | undefined;
      if (section) expect.soft(section, `${label} ${id}`).toMatchObject({ rule: 'none', ruleTransition: /^all 0s/ });
    }
    if (/lock at/.test(label)) expect.soft(site[label]?.['lock'], label).toEqual([]);
  }
});
