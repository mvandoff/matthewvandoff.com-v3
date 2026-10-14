import type { Page } from '@playwright/test';

/** The Terminal's parts, located the way a visitor perceives them. */
export function terminal(page: Page) {
  const box = page.locator('.cel.sig');
  return {
    box,
    input: page.getByRole('textbox', { name: 'terminal command, type help' }),
    body: page.locator('#term-body'),
    header: box.locator('.sig-row').first(),
    hint: box.locator('.t-hint'),
    /** The body's text, one entry per rendered line, spacing kept. */
    lines() {
      return this.body.evaluate((el) => (el as HTMLElement).innerText.split('\n'));
    },
    async run(command: string) {
      await this.input.fill(command);
      await this.input.press('Enter');
    },
  };
}
