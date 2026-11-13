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

  await dialog.getByRole('combobox', { name: 'Location' }).click();
  await expect(dialog.getByRole('listbox', { name: 'Inventory locations' })).toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, 'location-picker-1920x1080.png'), fullPage: true });
  await dialog.getByRole('combobox', { name: 'Location' }).fill('Area18');
  await dialog.getByRole('option', { name: /Area18/ }).click();
  await expect(dialog.getByRole('combobox', { name: 'Location' })).toHaveValue('Area18');

  const qualityPlaceholder = dialog.getByRole('spinbutton', { name: 'Quality for item 1 lot 1' });
  const amountPlaceholder = dialog.getByRole('spinbutton', { name: 'Amount for item 1 lot 1' });
  await expect(qualityPlaceholder).toHaveAttribute('placeholder', 'Quality');
  await expect(amountPlaceholder).toHaveAttribute('placeholder', 'Amount');
  await qualityPlaceholder.focus();
  await qualityPlaceholder.fill('');
  await expect(qualityPlaceholder).toBeEmpty();
  await qualityPlaceholder.fill('937');
  const firstSearch = dialog.getByRole('textbox', { name: 'Search item' }).first();
  await firstSearch.fill('Aphor');
  await expect(dialog.locator('.bq-inv-add-item-results')).toBeVisible();
  // Item suggestions must not intercept a tap on the Quality field below.
  await qualityPlaceholder.click({ timeout: 2500 });
  await expect(dialog.locator('.bq-inv-add-item-results')).toBeHidden();
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


for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
  test(`Add Inventory stays accessible on mobile at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`${fixturePath}?unlocked=1`, { waitUntil: 'domcontentloaded' });
    const dialog = page.getByRole('dialog', { name: 'Add Inventory' });
    const actions = dialog.locator('.bq-inv-quick-actions');
    const body = dialog.locator('.bq-inv-quick-body');
    await expect(dialog).toBeVisible();
    await expect(actions).toBeInViewport({ ratio: 1 });

    const search = dialog.getByRole('textbox', { name: 'Search item' }).first();
    const quality = dialog.getByRole('spinbutton', { name: 'Quality for item 1 lot 1' });
    const amount = dialog.getByRole('spinbutton', { name: 'Amount for item 1 lot 1' });
    for (const field of [search, quality, amount]) {
      await field.focus();
      const fontSize = await field.evaluate((input) => Number.parseFloat(getComputedStyle(input).fontSize));
      expect(fontSize).toBeGreaterThanOrEqual(16);
      await expect(actions).toBeInViewport({ ratio: 1 });
    }

    // A reduced visual height models the remaining space while mobile chrome
    // or the soft keyboard is visible. Actions must not disappear beneath it.
    await page.setViewportSize({ width: viewport.width, height: 420 });
    await expect(actions).toBeInViewport({ ratio: 1 });
    for (let index = 0; index < 3; index += 1) {
      await dialog.getByRole('button', { name: 'Add another item' }).click();
    }
    const overflow = await body.evaluate((element) => ({
      scrollHeight: element.scrollHeight, clientHeight: element.clientHeight,
    }));
    expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight);
    await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(actions).toBeInViewport({ ratio: 1 });
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(-1);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(421);
  });
}


test('local UI workshop is fixture-only and rejects backend API access', async ({ page, request }) => {
  const denied = await request.get('/api/user/inventory');
  expect(denied.status()).toBe(403);
  expect(await denied.text()).toContain('cannot reach any authentication or database API');

  const response = await page.goto(`${fixturePath}?unlocked=1`, { waitUntil: 'domcontentloaded' });
  expect(response?.headers()['content-security-policy']).toContain("connect-src 'self'");
  await expect(page.locator('[data-fixture-mode="active"]')).toBeVisible();
});
