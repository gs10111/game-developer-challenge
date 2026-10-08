import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

interface Snapshot {
  phase: string;
  step: number;
  score: number;
  spawned: number;
  outcome: string | null;
  player: { health: number };
  enemies: unknown[];
}

interface Seam {
  snapshot: () => Snapshot;
  advance: (steps: number) => void;
}

async function startMatch(page: Page, query = ''): Promise<void> {
  await page.goto(`/?e2e=1&seed=7${query}`);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
}

async function matchReady(page: Page): Promise<void> {
  await page.waitForFunction(() => 'pirateBattle' in window);
}

async function advance(page: Page, steps: number): Promise<Snapshot> {
  return page.evaluate((count) => {
    const seam = (window as unknown as { pirateBattle: Seam }).pirateBattle;
    seam.advance(count);
    return seam.snapshot();
  }, steps);
}

test('AR-06 a failure to load the assets is shown with a retry, and the retry starts the match', async ({
  page,
}) => {
  await startMatch(page, '&assets=fail-once');

  await expect(page.getByText('The arena could not be loaded.')).toBeVisible();

  await page.getByRole('button', { name: 'Try again' }).click();
  await matchReady(page);

  await expect(page.getByText('The arena could not be loaded.')).toHaveCount(0);
  expect((await advance(page, 1)).step).toBe(1);
});

test('MT-09 losing the focus pauses the match until the player resumes it', async ({ page }) => {
  await startMatch(page);
  await matchReady(page);
  await advance(page, 30);

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));

  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  const paused = await advance(page, 60);
  expect(paused.phase).toBe('paused');
  expect(paused.step).toBe(30);

  await page.getByRole('button', { name: 'Resume' }).click();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await advance(page, 5)).step).toBe(35);
});

test('MT-01 a match whose ship survives ends when its time is up', async ({ page }) => {
  await startMatch(page, '&perf=1');
  await matchReady(page);

  const ended = await advance(page, 7200);

  expect(ended.outcome).toBe('timeUp');
  expect(ended.step).toBe(7200);
  await expect(page.getByTestId('result-reason')).toHaveText('Time is up');
  await expect(page.getByTestId('result-time')).toHaveText('2:00');
  expect((await advance(page, 60)).step).toBe(7200);
});

test('MT-05 Play Again starts a clean match', async ({ page }) => {
  await startMatch(page);
  await matchReady(page);
  const ended = await advance(page, 7200);
  expect(ended.phase).toBe('ended');

  await page.getByRole('button', { name: 'Play Again' }).click();
  await page.waitForFunction(() => {
    const seam = (window as unknown as { pirateBattle?: Seam }).pirateBattle;
    return seam?.snapshot().step === 0;
  });

  const fresh = await advance(page, 0);
  expect(fresh).toMatchObject({
    phase: 'running',
    step: 0,
    score: 0,
    spawned: 0,
    outcome: null,
    enemies: [],
  });
  expect(fresh.player.health).toBe(100);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('API-14 a timeout after the server saved is recovered by sending again, with one record', async ({
  page,
}) => {
  await startMatch(page, '&scenario=timeout-after-save');
  await matchReady(page);
  await advance(page, 7200);

  await expect(page.getByTestId('record-status')).toHaveAttribute('data-status', 'saving');
  await expect(page.getByTestId('record-status')).toHaveAttribute('data-status', 'saved', {
    timeout: 25_000,
  });

  await page.getByRole('button', { name: 'Main Menu' }).click();
  await page.getByRole('tab', { name: 'Match History' }).click();

  await expect(page.locator('tbody tr')).toHaveCount(1);
});

test('API-11 a saved match appears in the ranking on the page its score puts it', async ({
  page,
}) => {
  await startMatch(page);
  await matchReady(page);
  const ended = await advance(page, 7200);
  expect(ended.score).toBe(0);
  await expect(page.getByTestId('record-status')).toHaveAttribute('data-status', 'saved', {
    timeout: 20_000,
  });

  await page.getByRole('button', { name: 'Main Menu' }).click();
  await page.getByRole('tab', { name: 'Ranking' }).click();
  for (const pageNumber of [2, 3, 4]) {
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByTestId('page-indicator')).toHaveText(`Page ${String(pageNumber)} of 4`);
  }

  await expect(page.locator('tr.own')).toContainText('Captain');
  await expect(page.locator('tr.own td').first()).toHaveText('19');
});
