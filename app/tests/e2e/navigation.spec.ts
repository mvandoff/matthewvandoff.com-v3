import { expect, test, type Page } from '@playwright/test';

/**
 * Navigation and scroll (spec stories 16-21, 33, 50): smooth scroll plus Lock-on
 * for the Cels, [ mvd ], back-to-top and `cd`; the header prompt, progress line
 * and border tracking the scroll; reveal-on-scroll; hash landing; reduced motion.
 */

const SECTIONS = ['about', 'experience', 'links'] as const;

/** Where a page scrolled to `#id` ends up: the Section at the top, or as far as the page scrolls. */
const landingFor = (page: Page, id: string) =>
  page
    .locator(`#${id}`)
    .evaluate((el) =>
      Math.min(Math.round(el.getBoundingClientRect().top + scrollY), document.documentElement.scrollHeight - innerHeight),
    );

const scrollTop = (page: Page) => page.evaluate(() => Math.round(scrollY));

const cel = (page: Page, label: string) => page.getByRole('link', { name: new RegExp(`^\\d\\d ${label}\\b`) });

/** The Lock-on tag on a Section heading ("found ~/about"). */
const lockTag = (page: Page, id: string) => page.locator(`#${id} .locktag`);

test.describe('Cels', () => {
  for (const id of SECTIONS) {
    test(`clicking the ${id} Cel scrolls to it and locks on`, async ({ page }) => {
      await page.goto('/');
      await cel(page, id).click();
      await expect.poll(() => scrollTop(page)).toBe(await landingFor(page, id));
      await expect(lockTag(page, id)).toHaveText(`found ~/${id}`);
      await expect(lockTag(page, id)).toBeVisible();
      await expect(page.locator(`#${id} .lock`)).toBeVisible();
      // The bracket is brief: gone again after its 1.5s run.
      await expect(lockTag(page, id)).toBeHidden({ timeout: 4000 });
      await expect(page).toHaveURL(/\/$/);
    });
  }
});

test.describe('home', () => {
  for (const [name, link] of [
    ['[ mvd ]', (page: Page) => page.getByRole('banner').getByRole('link', { name: '[ mvd ]' })],
    ['back to top', (page: Page) => page.getByRole('link', { name: '[ back to top ↑ ]' })],
  ] as const) {
    test(`${name} scrolls back to the top and locks on the whoami line`, async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await link(page).click();
      await expect.poll(() => scrollTop(page)).toBe(0);
      const lock = page.locator('.nc-prompt .lock');
      await expect(lock).toBeVisible();
      await expect(lock).toBeHidden({ timeout: 4000 });
      await expect(page).toHaveURL(/\/$/);
    });
  }
});

test.describe('cd', () => {
  for (const id of SECTIONS) {
    test(`cd ${id} locks on its heading`, async ({ page }) => {
      await page.goto('/');
      const input = page.getByRole('textbox', { name: 'terminal command, type help' });
      await input.fill(`cd ${id}`);
      await input.press('Enter');
      await expect.poll(() => scrollTop(page)).toBe(await landingFor(page, id));
      await expect(lockTag(page, id)).toBeVisible();
    });
  }

  test('only the latest target locks on', async ({ page }) => {
    await page.goto('/');
    const input = page.getByRole('textbox', { name: 'terminal command, type help' });
    await input.fill('cd about');
    await input.press('Enter');
    await input.fill('cd links');
    await input.press('Enter');
    await expect(lockTag(page, 'links')).toBeVisible();
    await expect(page.locator('.locktag:visible')).toHaveCount(1);
  });
});
