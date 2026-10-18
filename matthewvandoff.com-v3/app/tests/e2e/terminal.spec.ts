import { expect, test, type Page } from '@playwright/test';
import { terminal } from '../helpers/terminal.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('help lists the commands and echoes in the header', async ({ page }) => {
  const t = terminal(page);
  await t.run('help');
  await expect.poll(() => t.lines()).toEqual([
    'top · np · recent                 music, via last.fm',
    'ls · cd <section>                 move around the page',
    'accent <color|hue|random>         recolor the site',
    'whoami · date · clear             tab completes · ↑ recalls',
  ]);
  await expect(t.header).toContainText('01b · ~/now $ help');
  await expect(t.input).toHaveValue('');
  await expect(t.hint).toHaveText('esc · close');
});

test.describe('expansion on desktop', () => {
  const top = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!.y;

  test('large output (help) expands the Terminal over the Name card with 13px/1.8 text', async ({ page }) => {
    const t = terminal(page);
    const nameCardTop = await top(page, '.cel.lead');
    expect(await top(page, '.cel.sig')).toBeGreaterThan(nameCardTop + 400);
    await t.run('help');
    await expect.poll(() => top(page, '.cel.sig')).toBeCloseTo(nameCardTop, 0);
    await expect(page.locator('.cel.lead')).toHaveCSS('opacity', '0');
    await expect(t.body).toHaveCSS('font-size', '13px');
    await expect(t.body).toHaveCSS('line-height', '23.4px');
    await expect(t.box).toHaveCSS('background-color', 'rgb(29, 30, 36)');
  });

  test('small output (ls) stays in place, and closing collapses an expanded Terminal', async ({ page }) => {
    const t = terminal(page);
    const restingTop = await top(page, '.cel.sig');
    await t.run('help');
    await expect.poll(() => top(page, '.cel.sig')).toBeLessThan(restingTop - 400);
    await t.run('ls');
    await expect.poll(() => t.lines()).toEqual(['about/   experience/   links/', 'cd <name> to jump there']);
    await expect.poll(() => top(page, '.cel.sig')).toBeCloseTo(restingTop, 0);
    await expect(t.body).toHaveCSS('font-size', '12px');
    await expect(page.locator('.cel.lead')).toHaveCSS('opacity', '1');
  });
});

test('unknown commands, whoami and sudo reply in small output with the input echoed as typed', async ({ page }) => {
  const t = terminal(page);
  await t.run('Foo');
  await expect.poll(() => t.lines()).toEqual(['command not found: foo  · try help']);
  await expect(t.header).toContainText('01b · ~/now $ Foo');
  await t.run('whoami');
  await expect.poll(() => t.lines()).toEqual([
    'matthew van doff',
    'software developer · for the information superhighway',
  ]);
  await t.run('sudo make me a sandwich');
  await expect.poll(() => t.lines()).toEqual(['nice try. this incident will be reported.']);
});

test('date prints the local date and time; clear goes back to the idle status', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 9, 30, 5));
  const t = terminal(page);
  await t.run('date');
  await expect.poll(() => t.lines()).toEqual(['wed oct 14 2026 09:30:05']);
  await t.run('clear');
  await expect(t.body).toContainText(/building\s*Insight @ Cyncly/);
  await expect(t.header).toContainText('01b · ~/now $ cat status.txt');
  await expect(t.hint).toHaveText('try help');
});

test('Tab completes commands, then arguments, and lists options without changing the header', async ({ page }) => {
  const t = terminal(page);
  await t.input.fill('wh');
  await t.input.press('Tab');
  await expect(t.input).toHaveValue('whoami ');
  await expect(t.input).toBeFocused();

  await t.input.fill('cd ex');
  await t.input.press('Tab');
  await expect(t.input).toHaveValue('cd experience ');

  await t.input.fill('top -');
  await t.input.press('Tab');
  await expect(t.input).toHaveValue('top --');

  await t.input.fill('cd ');
  await t.input.press('Tab');
  await expect.poll(() => t.lines()).toEqual(['about   experience   links   home']);
  await expect(t.header).toContainText('01b · ~/now $ cat status.txt');
  await expect(t.input).toHaveValue('cd ');
  await expect(t.hint).toHaveText('esc · close');
});

test('Tab on an empty input moves focus on as usual', async ({ page }) => {
  const t = terminal(page);
  await t.input.focus();
  await t.input.press('Tab');
  await expect(t.input).not.toBeFocused();
});

test('↑/↓ recall earlier commands, ending on an empty input', async ({ page }) => {
  const t = terminal(page);
  for (const cmd of ['help', 'ls', 'ls', 'whoami']) await t.run(cmd);
  await t.input.press('ArrowUp');
  await expect(t.input).toHaveValue('whoami');
  await t.input.press('ArrowUp');
  await expect(t.input).toHaveValue('ls');
  await t.input.press('ArrowUp');
  await expect(t.input).toHaveValue('help');
  await t.input.press('ArrowUp');
  await expect(t.input).toHaveValue('help');
  await t.input.press('ArrowDown');
  await t.input.press('ArrowDown');
  await expect(t.input).toHaveValue('whoami');
  await t.input.press('ArrowDown');
  await expect(t.input).toHaveValue('');
});

test('Esc clears the output and input, collapses the Terminal and blurs it', async ({ page }) => {
  const t = terminal(page);
  await t.run('help');
  await t.input.fill('half typed');
  await t.input.press('Escape');
  await expect(t.input).toHaveValue('');
  await expect(t.input).not.toBeFocused();
  await expect(t.body).toContainText(/building\s*Insight @ Cyncly/);
  await expect(t.header).toContainText('01b · ~/now $ cat status.txt');
  await expect(page.locator('.cel.lead')).toHaveCSS('opacity', '1');
  await expect(t.hint).toHaveText('try help');
});

test('clicking anywhere in the Terminal focuses the input, unless text is selected', async ({ page }) => {
  const t = terminal(page);
  await t.body.click();
  await expect(t.input).toBeFocused();

  await t.input.blur();
  await t.body.locator('dd').first().selectText();
  await t.body.locator('dd').first().click({ position: { x: 2, y: 2 }, modifiers: ['Shift'] });
  await expect(t.input).not.toBeFocused();
});

test('the cursor blinks and the hint says "try help" until the visitor types', async ({ page }) => {
  const t = terminal(page);
  const cursor = t.box.locator('.cur');
  await expect(cursor).toBeVisible();
  await expect(t.hint).toHaveText('try help');
  await t.input.focus();
  await expect(cursor).toBeHidden();
  await t.input.pressSequentially('he');
  await expect(t.hint).toHaveText('');
  await t.input.blur();
  await expect(cursor).toBeHidden();
  await t.input.focus();
  await t.input.press('Backspace');
  await t.input.press('Backspace');
  await t.input.blur();
  await expect(cursor).toBeVisible();
  await expect(t.hint).toHaveText('try help');
});

test('the output is announced politely and scrolls back to the top on each run', async ({ page }) => {
  const t = terminal(page);
  await expect(t.body).toHaveAttribute('aria-live', 'polite');
  await page.setViewportSize({ width: 1440, height: 560 });
  await t.run('help');
  await t.body.evaluate((el) => (el.scrollTop = 40));
  await t.run('help');
  await expect.poll(() => t.body.evaluate((el) => el.scrollTop)).toBe(0);
});

test.describe('cd', () => {
  test('scrolls to each Section and back home', async ({ page }) => {
    const t = terminal(page);
    for (const name of ['about', 'experience', 'links']) {
      await t.run(`cd ${name}`);
      await expect.poll(() => t.lines()).toEqual([`→ ~/${name}`]);
      // Lands with the Section at the top of the viewport, or as far as the page scrolls
      // (measured without the reveal's offset, which a Section not yet seen still has).
      const landing = await page.locator(`section#${name}`).evaluate((el) => {
        const top = el.getBoundingClientRect().top + scrollY - new DOMMatrix(getComputedStyle(el).transform).f;
        return Math.min(Math.round(top), document.documentElement.scrollHeight - innerHeight);
      });
      await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(landing);
    }
    await t.run('cd ~/');
    await expect.poll(() => t.lines()).toEqual(['→ ~/home']);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  });

  test('says so for an unknown section and stays put', async ({ page }) => {
    const t = terminal(page);
    await t.run('cd work/');
    await expect.poll(() => t.lines()).toEqual(['cd: no such section: work']);
    expect(await page.evaluate(() => scrollY)).toBe(0);
  });
});
