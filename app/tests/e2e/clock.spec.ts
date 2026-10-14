import { expect, test } from '@playwright/test';

test('the Name card clock shows the current time and ticks every second', async ({ page }) => {
  // Paused, so the clock only moves when the test runs it (a loaded machine can't tick it on).
  await page.clock.install({ time: new Date(2026, 9, 14, 9, 30, 0) });
  await page.clock.pauseAt(new Date(2026, 9, 14, 9, 30, 5));
  await page.goto('/');

  const stamp = page.getByText(/^\w{3} \d{2} \w{3} \d{4} · \d{2}:\d{2}:\d{2}$/);
  await expect(stamp).toHaveText('wed 14 oct 2026 · 09:30:05');

  await page.clock.runFor(1000);
  await expect(stamp).toHaveText('wed 14 oct 2026 · 09:30:06');

  await page.clock.runFor(60_000);
  await expect(stamp).toHaveText('wed 14 oct 2026 · 09:31:06');
});
