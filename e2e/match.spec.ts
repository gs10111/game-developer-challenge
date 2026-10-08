import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

interface Snapshot {
  phase: string;
  step: number;
  score: number;
  spawned: number;
  outcome: string | null;
  player: { x: number; y: number; heading: number; health: number };
  enemies: { kind: string }[];
  projectiles: number;
}

interface Seam {
  snapshot: () => Snapshot;
  advance: (steps: number) => void;
}

async function startMatch(page: Page, query = ''): Promise<void> {
  await page.goto(`/?e2e=1&seed=7${query}`);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(() => 'pirateBattle' in window);
}

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => (window as unknown as { pirateBattle: Seam }).pirateBattle.snapshot());
}

async function advance(page: Page, steps: number): Promise<Snapshot> {
  return page.evaluate((count) => {
    const seam = (window as unknown as { pirateBattle: Seam }).pirateBattle;
    seam.advance(count);
    return seam.snapshot();
  }, steps);
}

test('PL-01 the player sails and turns with the keyboard and stops at the wall of the arena', async ({
  page,
}) => {
  await startMatch(page);
  const start = await snapshot(page);

  await page.keyboard.down('KeyW');
  const sailed = await advance(page, 60);
  const atTheWall = await advance(page, 600);
  await page.keyboard.up('KeyW');

  expect(start.player.heading).toBe(0);
  expect(start.player.y).toBe(288);
  expect(sailed.player.x).toBeGreaterThan(start.player.x + 100);
  expect(atTheWall.player.x).toBe(1000);

  await page.keyboard.down('KeyD');
  const turned = await advance(page, 30);
  await page.keyboard.up('KeyD');

  expect(turned.player.heading).toBeGreaterThan(0);
});

test('PL-02 the front cannon and a broadside fire while the ship moves', async ({ page }) => {
  await startMatch(page);
  const before = await snapshot(page);

  await page.keyboard.down('KeyW');
  await page.keyboard.down('Space');
  const afterFront = await advance(page, 3);
  await page.keyboard.up('Space');
  await page.keyboard.down('KeyQ');
  const afterBroadside = await advance(page, 3);
  await page.keyboard.up('KeyQ');
  await page.keyboard.up('KeyW');

  expect(before.projectiles).toBe(0);
  expect(afterFront.projectiles).toBe(1);
  expect(afterBroadside.projectiles).toBe(4);
  expect(afterBroadside.player.x).toBeGreaterThan(before.player.x);
});

test('EN-08 both enemy types spawn at the configured interval', async ({ page }) => {
  await startMatch(page);

  const first = await advance(page, 190 - (await snapshot(page)).step);
  const second = await advance(page, 180);

  expect(first.spawned).toBe(1);
  expect(second.spawned).toBe(2);
  expect(first.enemies.map(({ kind }) => kind)).toEqual(['chaser']);
  expect(second.enemies.map(({ kind }) => kind)).toContain('shooter');
});

test('MT-08 pausing suspends the match and only an action of the player resumes it', async ({
  page,
}) => {
  await startMatch(page);

  await page.keyboard.press('KeyP');

  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  const paused = await snapshot(page);
  await page.waitForTimeout(400);
  const later = await advance(page, 120);
  expect(paused.phase).toBe('paused');
  expect(later.step).toBe(paused.step);

  await page.getByRole('button', { name: 'Resume' }).click();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await advance(page, 10)).step).toBeGreaterThan(paused.step);
});

test('MT-03 a match that ends shows its result, saves one record and survives a refresh', async ({
  page,
}) => {
  await startMatch(page);

  const ended = await advance(page, 7200);

  expect(ended.phase).toBe('ended');
  expect(ended.outcome).toBe('defeated');
  await expect(page.getByRole('dialog', { name: 'Match over' })).toBeVisible();
  await expect(page.getByTestId('result-reason')).toHaveText('Ship destroyed');
  await expect(page.getByTestId('result-score')).toHaveText(String(ended.score));
  await expect(page.getByTestId('record-status')).toHaveAttribute('data-status', 'saved');
  expect((await advance(page, 300)).step).toBe(ended.step);

  await page.getByRole('button', { name: 'Main Menu' }).click();
  await page.getByRole('tab', { name: 'Match History' }).click();

  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('Ship destroyed');

  await page.reload();

  await expect(page.getByTestId('last-result')).toContainText('ship destroyed');
  await page.getByRole('tab', { name: 'Match History' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
});

test('MSW-08 a record that cannot be saved stays pending and is saved after the API recovers', async ({
  page,
}) => {
  await startMatch(page, '&scenario=save-unavailable');
  await advance(page, 7200);

  await expect(page.getByTestId('record-status')).toHaveAttribute('data-status', 'failed', {
    timeout: 20_000,
  });

  await page.goto('/?scenario=success');

  await expect(page.getByTestId('last-result')).toBeVisible();
  await expect(page.getByTestId('record-status')).toHaveAttribute('data-status', 'saved', {
    timeout: 20_000,
  });
  await page.getByRole('tab', { name: 'Match History' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
});

test('SC-14 leaving a match abandons it, and the touch controls steer the ship', async ({ page }) => {
  await startMatch(page);
  if (!(await page.getByTestId('touch-controls').isVisible())) {
    await page.getByRole('button', { name: 'Touch' }).click();
  }
  const start = await snapshot(page);

  await page.getByRole('button', { name: 'Sail forward' }).hover();
  await page.mouse.down();
  const sailed = await advance(page, 60);
  await page.mouse.up();

  expect(sailed.player.x).toBeGreaterThan(start.player.x + 100);

  await page.getByRole('button', { name: 'Exit' }).click();
  await page.getByRole('tab', { name: 'Match History' }).click();

  await expect(page.getByTestId('empty-list')).toBeVisible();
});
