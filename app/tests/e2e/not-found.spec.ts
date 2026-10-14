import { expect, test } from '@playwright/test';

test.describe('404 page', () => {
  test('an unknown path shows that path and the link goes home', async ({ page }) => {
    const response = await page.goto('/no/such/page');
    expect(response?.status()).toBe(404);
    await expect(page.getByText('cd: no such page: /no/such/page')).toBeVisible();
    await page.getByRole('link', { name: '[ back home ]' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('section#about')).toBeAttached();
  });

  test('the path is shown as text, not parsed as HTML', async ({ page }) => {
    await page.goto('/%3Cb%3Ebold');
    await expect(page.locator('main b')).toHaveCount(0);
    await expect(page.getByText('cd: no such page: /<b>bold')).toBeVisible();
  });

  test('without JavaScript it shows a generic line and still links home', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/no/such/page');
    await expect(page.getByText('cd: no such page')).toBeVisible();
    await expect(page.getByText('/no/such/page')).toHaveCount(0);
    await page.getByRole('link', { name: '[ back home ]' }).click();
    await expect(page).toHaveURL('/');
    await context.close();
  });
});
