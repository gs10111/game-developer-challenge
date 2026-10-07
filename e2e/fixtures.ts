import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ failOnConsoleErrors: undefined }>({
  failOnConsoleErrors: [
    async ({ page }, use) => {
      const consoleErrors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleErrors.push(`console.error: ${message.text()}`);
        }
      });
      page.on('pageerror', (error) => {
        consoleErrors.push(`uncaught: ${error.message}`);
      });

      await use(undefined);

      expect(consoleErrors, 'UX-12 the console stays free of errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
