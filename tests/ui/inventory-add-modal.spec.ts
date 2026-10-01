import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const fixturePath = '/logistics/build-queue/__fixture/add-inventory';

test('Add Inventory keeps the page location isolated and emits multiple item lots', async ({ page }) => {
  const screenshotDir = path.join('test-artifacts', 'inventory-add-modal');
  await mkdir(screenshotDir, { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${fixturePath}?unlocked=1`, { waitUntil: 'domcontentloaded' });

  const dialog = page.getByRole('dialog', { name: 'Add Inventory' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Location', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Items', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Add Inventory', exact: true })).toBeDisabled();

  await dialog.getByRole('button', { name: 'Change' }).click();
  await expect(dialog.getByPlaceholder('Search all locations...')).toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, 'location-picker-1920x1080.png'), fullPage: true });
  await dialog.getByPlaceholder('Search all locations...').fill('Area18');
  await dialog.getByRole('button', { name: /Area18/ }).click();
  await expect(dialog.getByText('Area18', { exact: true })).toBeVisible();

  const firstSearch = dialog.getByRole('textbox', { name: 'Search item' }).first();
  await firstSearch.fill('Aphorite');
  await dialog.getByRole('button', { name: /Aphorite.*Material/ }).click();
  await dialog.getByRole('button', { name: 'Add another item' }).click();
  const secondSearch = dialog.getByRole('textbox', { name: 'Search item' }).nth(1);
  await secondSearch.fill('Avalanche Cooler');
  await dialog.getByRole('button', { name: /Avalanche Cooler.*ship_part/ }).click();
  await dialog.getByRole('spinbutton', { name: 'Quality for item 2 lot 1' }).fill('900');
  await dialog.getByRole('spinbutton', { name: 'Amount for item 2 lot 1' }).fill('2');
  await dialog.getByRole('button', { name: 'Add another quality' }).last().click();
  await dialog.getByRole('button', { name: /Remove quality lot 2/ }).last().click();
  await page.screenshot({ path: path.join(screenshotDir, 'multi-item-lots-1920x1080.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Add Inventory', exact: true }).click();

  await expect.poll(async () => page.locator('[data-fixture-emitted]').getAttribute('data-fixture-emitted')).not.toBe('[]');
  const emitted = JSON.parse((await page.locator('[data-fixture-emitted]').getAttribute('data-fixture-emitted')) ?? '[]') as Array<{ locationId?: string; materialId?: string; catalogItemId?: string; recordKind?: string }>;
  expect(emitted.length).toBeGreaterThan(6);
  expect(emitted.every((entry) => entry.locationId === 'area18' && entry.recordKind === 'box')).toBe(true);
  expect(emitted.some((entry) => entry.materialId === 'aphorite')).toBe(true);
  expect(emitted.some((entry) => entry.catalogItemId === 'avalanche-cooler')).toBe(true);
});
