import { expect, test } from '@playwright/test';

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('every Section is fully visible', async ({ page }) => {
    await page.goto('/');
    for (const id of ['about', 'experience', 'links']) {
      const section = page.locator(`section#${id}`);
      await section.scrollIntoViewIfNeeded();
      await expect(section).toBeVisible();
      await expect(section).toHaveCSS('opacity', '1');
    }
  });

  test('each Cel is a plain anchor link to its Section', async ({ page }) => {
    await page.goto('/');
    for (const [label, id] of [
      ['about', 'about'],
      ['experience', 'experience'],
      ['links', 'links'],
    ] as const) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByRole('link', { name: new RegExp(`^\\d\\d ${label}\\b`) }).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(page.locator(`section#${id}`)).toBeInViewport();
    }
  });

  test('the Terminal shows its idle status', async ({ page }) => {
    await page.goto('/');
    const input = page.getByRole('textbox', { name: 'terminal command, type help' });
    await expect(input).toBeVisible();
    await expect(page.getByText('01b · ~/now $ cat status.txt')).toBeVisible();
    const status = page.locator('#term-body');
    await expect(status).toContainText(/building\s*Insight @ Cyncly/);
    await expect(status).toContainText(/listening\s*\S/);
  });
});
