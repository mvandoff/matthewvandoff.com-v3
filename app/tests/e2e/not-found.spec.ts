import { expect, test, type Page } from '@playwright/test';

const tryLine = (page: Page) => page.getByText(/^try:/);

test.describe('404 page', () => {
  test('an unknown path shows that path and the link goes home', async ({ page }) => {
    const response = await page.goto('/no/such/page');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: '404' })).toBeVisible();
    await expect(page.getByText('page not found')).toBeVisible();
    await expect(page.getByText('cd: no such page: /no/such/page')).toBeVisible();
    await expect(tryLine(page)).toBeHidden();
    await page.getByRole('link', { name: '[ back home ]' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('section#about')).toBeAttached();
  });

  test('the path is shown as text, not parsed as HTML', async ({ page }) => {
    await page.goto('/%3Cb%3Ebold');
    await expect(page.locator('main b')).toHaveCount(0);
    await expect(page.getByText('cd: no such page: /<b>bold')).toBeVisible();
  });

  for (const path of ['/work/', '/work', '/resume.pdf']) {
    test(`the old v2 path ${path} suggests the experience Section`, async ({ page }) => {
      await page.goto(path);
      await expect(tryLine(page)).toBeVisible();
      await page.getByRole('link', { name: 'cd ~/experience' }).click();
      await expect(page).toHaveURL('/#experience');
      await expect(page.locator('section#experience')).toBeInViewport();
    });
  }

  test('a path that only starts like an old one suggests nothing', async ({ page }) => {
    await page.goto('/workshop');
    await expect(page.getByText('cd: no such page: /workshop')).toBeVisible();
    await expect(tryLine(page)).toBeHidden();
  });

  test('the Cels link to the Sections on the home page', async ({ page }) => {
    await page.goto('/no/such/page');
    for (const id of ['about', 'experience', 'links']) {
      await expect(page.getByRole('link', { name: new RegExp(`^\\d\\d ${id}\\b`) })).toHaveAttribute('href', `/#${id}`);
    }
    await page.getByRole('link', { name: /^\d\d links\b/ }).click();
    await expect(page).toHaveURL('/#links');
    await expect(page.locator('section#links')).toBeInViewport();
  });

  test('without JavaScript it shows a generic line and still links home', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/work/');
    await expect(page.getByRole('heading', { level: 1, name: '404' })).toBeVisible();
    await expect(page.getByText('cd: no such page')).toBeVisible();
    await expect(page.getByText('/work/')).toHaveCount(0);
    await expect(tryLine(page)).toBeHidden();
    await expect(page.getByRole('link', { name: /^\d\d experience\b/ })).toBeVisible();
    await page.getByRole('link', { name: '[ back home ]' }).click();
    await expect(page).toHaveURL('/');
    await context.close();
  });

  test('under reduced motion nothing on it animates', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/no/such/page');
    const running = await page.evaluate(() =>
      document.getAnimations().filter((animation) => animation.playState === 'running').length,
    );
    expect(running).toBe(0);
    await context.close();
  });

  test.describe('at 390px', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('it stacks without overflow, with the way home on the first screen', async ({ page }) => {
      await page.goto(`/a/very/long/old/path/${'that-keeps-going-'.repeat(6)}.html`);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
      await expect(page.getByRole('link', { name: '[ back home ]' })).toBeInViewport();

      const card = await page.getByRole('heading', { level: 1, name: '404' }).boundingBox();
      const back = await page.getByRole('link', { name: '[ back home ]' }).boundingBox();
      const cel = await page.getByRole('link', { name: /^02 about\b/ }).boundingBox();
      expect(card!.y).toBeLessThan(back!.y);
      expect(back!.y).toBeLessThan(cel!.y);
    });
  });
});
