import { expect, test } from './fixtures';

test('MSW-11 the production build renders data served by the mock API', async ({ page }) => {
  const healthResponse = page.waitForResponse('**/api/health');

  await page.goto('/');

  expect((await healthResponse).fromServiceWorker()).toBe(true);
  await expect(page.getByRole('heading', { name: 'Pirate Battle' })).toBeVisible();
  await expect(page.getByTestId('mock-api-status')).toHaveText('Mock API: ok');
});
