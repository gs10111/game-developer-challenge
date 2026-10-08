import { expect, test } from './fixtures';

test('MSW-11 the production build serves the ranking from the mock API', async ({ page }) => {
  const ranking = page.waitForResponse('**/api/ranking**');

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pirate Battle' })).toBeVisible();
  await page.getByRole('tab', { name: 'Ranking' }).click();

  expect((await ranking).fromServiceWorker()).toBe(true);
  await expect(page.getByRole('cell', { name: 'Blackbeard' })).toBeVisible();
});

test('UX-01 the options are validated, saved and kept after a refresh', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Options' }).click();
  const sessionTime = page.getByLabel('Game session time (seconds)');
  const spawnTime = page.getByLabel('Enemy spawn time (seconds)');

  await sessionTime.fill('30');
  await spawnTime.fill('0');
  await page.getByRole('button', { name: 'Save options' }).click();

  await expect(page.getByText('Use at least 60 seconds.')).toBeVisible();
  await expect(page.getByText('Use at least 0.5 seconds.')).toBeVisible();
  await expect(page.getByTestId('options-status')).toBeEmpty();

  await sessionTime.fill('90');
  await spawnTime.fill('2.5');
  await page.getByRole('button', { name: 'Save options' }).click();

  await expect(page.getByTestId('options-status')).toContainText('Options saved');

  await page.reload();
  await page.getByRole('tab', { name: 'Options' }).click();

  await expect(page.getByLabel('Game session time (seconds)')).toHaveValue('90');
  await expect(page.getByLabel('Enemy spawn time (seconds)')).toHaveValue('2.5');
});

test('RK-01 the ranking is paginated and ordered by score', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Ranking' }).click();

  await expect(page.getByTestId('page-indicator')).toHaveText('Page 1 of 4');
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await expect(page.locator('tbody tr').first()).toContainText('Blackbeard');

  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByTestId('page-indicator')).toHaveText('Page 2 of 4');
  await expect(page.locator('tbody tr').first().locator('td').first()).toHaveText('6');
});

test('RK-02 an empty history and a failing ranking are shown as such, and the game stays reachable', async ({
  page,
}) => {
  await page.goto('/?scenario=empty');
  await page.getByRole('tab', { name: 'Match History' }).click();

  await expect(page.getByTestId('empty-list')).toHaveText('You have not finished a match yet.');

  await page.goto('/?scenario=server-error');
  await page.getByRole('tab', { name: 'Ranking' }).click();

  await expect(page.getByText('The ranking could not be loaded.')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();

  await page.getByRole('tab', { name: 'Play' }).click();

  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
});
