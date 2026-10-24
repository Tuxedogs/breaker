import { expect, test } from '@playwright/test';
import { buildQueueTargetFixture, FIXTURE_ITEM_IDS } from '../../src/pages/logistics/buildQueueStatsFixture';

// Exercise production routes/store/auth with disposable browser-local records.
// The adapter is deliberately localhost-only; this is not live backend evidence.
for (const width of [1920, 390]) {
  test(`Build Queue Add Inventory uses location and physical lots at ${width}`, async ({ page, context }, testInfo) => {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 });
    const fixture = buildQueueTargetFixture;
    const item = fixture.buildQueue.find(entry => entry.id === FIXTURE_ITEM_IDS.ad5b)!;
    const remote = {
      locations: [{ id: 'beta-disposable-location', name: 'Beta Test Bay', system: 'Stanton', source: 'custom' }],
      inventoryEntries: [], buildQueues: fixture.buildQueues,
      buildQueue: [{ ...item, reservedAllocations: [] }], activeBuildQueueId: item.queueId,
      sync: { migratedAt: '2026-10-23T00:00:00Z' },
    };
    const user = { id: '00000000-0000-4000-8000-000000000050', aud: 'authenticated', role: 'authenticated', email: 'beta@example.invalid', app_metadata: { provider: 'discord', providers: ['discord'] }, user_metadata: { full_name: 'Disposable UI Test' }, created_at: '2026-10-23T00:00:00Z' };
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const access_token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: 4102444800, aud: 'authenticated', role: 'authenticated' })}.fixture`;
    await page.addInitScript(({ remote, session }) => {
      localStorage.setItem('sb-127-auth-token', JSON.stringify(session));
      const key = 'beta-disposable-remote';
      const state = JSON.parse(localStorage.getItem(key) ?? JSON.stringify(remote));
      const original = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.origin);
        if (url.origin === location.origin && (url.pathname.startsWith('/api/user/') || url.pathname.startsWith('/auth/v1/'))) {
          if (url.pathname.endsWith('/inventory/sync') && init?.method === 'PUT') {
            const payload = JSON.parse(String(init.body));
            if (payload.inventoryEntries?.length && !localStorage.getItem('beta-save-attempt')) {
              localStorage.setItem('beta-save-attempt', JSON.stringify(payload.inventoryEntries.map((entry: { id: string }) => entry.id)));
              return new Response(JSON.stringify({ error: 'Disposable adapter save failure. Retry.' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
            }
            if (payload.inventoryEntries?.length) {
              await new Promise<void>(resolve => {
                (window as Window & { __betaReleaseSave?: () => void }).__betaReleaseSave = resolve;
              });
            }
            for (const field of ['locations', 'inventoryEntries', 'buildQueues', 'buildQueue']) {
              for (const entry of payload[field] ?? []) {
                const index = state[field].findIndex((current: { id: string }) => current.id === entry.id);
                if (index < 0) state[field].push(entry); else state[field][index] = entry;
              }
            }
            localStorage.setItem(key, JSON.stringify(state));
          }
          return new Response(JSON.stringify(url.pathname.startsWith('/auth/v1/') ? session.user : state), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return original(input, init);
      };
    }, { remote, session: { access_token, refresh_token: 'fixture-only', token_type: 'bearer', expires_at: 4102444800, expires_in: 36000000, user } });
    await page.goto('/logistics/build-queue', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.bq-item-name')).toHaveText('AD5B Ballistic Gatling');
    await expect(page.locator('.bq-component-statistics[data-bq-stats-status="ready"]')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('queue-page.png') });
    const add = page.getByRole('button', { name: 'Add inventory for Iron', exact: true });
    await expect(add).toBeVisible();
    await add.click();
    const dialog = page.getByRole('dialog', { name: 'Add Inventory' });
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole('button', { name: 'Close add inventory' });
    await expect(close).toBeFocused();
    const heading = dialog.getByRole('heading', { name: 'Add Inventory' });
    const bounds = (await heading.boundingBox())!;
    expect(await heading.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return node.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
    })).toBe(true);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    await expect(dialog.getByText('Locked build queue material')).toBeVisible();
    await dialog.getByRole('button', { name: 'Change', exact: true }).click();
    await dialog.getByPlaceholder('Search all locations...').fill('Beta Test Bay');
    await dialog.getByRole('button', { name: /Beta Test Bay/ }).click();
    await dialog.getByRole('spinbutton', { name: 'Amount for item 1 lot 1', exact: true }).fill('8');
    await expect(dialog.getByRole('button', { name: 'Add Inventory', exact: true })).toBeDisabled();
    await dialog.getByRole('spinbutton', { name: 'Quality for item 1 lot 1', exact: true }).fill('0');
    await expect(dialog.getByRole('button', { name: 'Add Inventory', exact: true })).toBeEnabled();
    await dialog.getByRole('spinbutton', { name: 'Quality for item 1 lot 1', exact: true }).fill('975');
    await dialog.getByRole('spinbutton', { name: 'Amount for item 1 lot 1', exact: true }).fill('8');
    await dialog.getByRole('button', { name: 'Add another quality' }).click();
    await dialog.getByRole('spinbutton', { name: 'Quality for item 1 lot 2', exact: true }).fill('900');
    await dialog.getByRole('spinbutton', { name: 'Amount for item 1 lot 2', exact: true }).fill('2');
    await page.screenshot({ path: testInfo.outputPath('queue-add-inventory.png') });
    const save = dialog.getByRole('button', { name: 'Add Inventory', exact: true });
    await save.focus();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(save).toBeFocused();
    await save.click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Disposable adapter save failure. Retry.');
    await expect(dialog.getByRole('spinbutton', { name: 'Amount for item 1 lot 1', exact: true })).toHaveValue('8');
    await expect(dialog.getByRole('spinbutton', { name: 'Amount for item 1 lot 2', exact: true })).toHaveValue('2');
    await expect(save).toBeEnabled();
    await save.click();
    await expect(close).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await page.evaluate(() => (window as Window & { __betaReleaseSave?: () => void }).__betaReleaseSave?.());
    await expect(dialog).toBeHidden();
    await expect(add).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath('queue-added-inventory.png') });
    const savedLots = await page.evaluate(() => JSON.parse(localStorage.getItem('beta-disposable-remote')!).inventoryEntries);
    expect(savedLots).toHaveLength(2);
    expect(savedLots.map((entry: { id: string }) => entry.id)).toEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('beta-save-attempt')!)));
    expect(savedLots).toEqual(expect.arrayContaining([
      expect.objectContaining({ materialId: 'iron', materialType: 'refined', locationId: 'beta-disposable-location', quality: 975, quantity: 8, recordKind: 'box' }),
      expect.objectContaining({ materialId: 'iron', materialType: 'refined', locationId: 'beta-disposable-location', quality: 900, quantity: 2, recordKind: 'box' }),
    ]));
    await page.getByRole('button', { name: 'Add quality allocation for Iron', exact: true }).click();
    const reserve = page.getByRole('dialog', { name: 'Reserve Iron', exact: true });
    await expect(reserve).toBeVisible();
    await expect(reserve).toContainText('Beta Test Bay');
    await expect(reserve).toContainText('975');
    await expect(reserve).toContainText('900');
    const highestQuality = reserve.locator('.bq-reserve-quality-folder').filter({ has: page.locator('summary', { hasText: '975' }) });
    await highestQuality.locator(':scope > summary').click();
    const reserveBox = highestQuality.getByRole('checkbox');
    await reserveBox.check();
    await expect(reserveBox).toBeChecked();
    await expect.poll(() => page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('beta-disposable-remote')!);
      return state.buildQueue[0].reservedAllocations?.length ?? 0;
    })).toBe(1);
    await page.screenshot({ path: testInfo.outputPath('queue-reserve-inventory.png') });
    await reserve.getByRole('button', { name: 'Close reserve drawer', exact: true }).click();
    await page.goto('/logistics/inventory', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.logi-inv-page')).toContainText('Beta Test Bay');
    await expect(page.locator('.logi-inv-page')).toContainText('Iron');
    await page.screenshot({ path: testInfo.outputPath('inventory-added-lots.png') });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.logi-inv-page')).toContainText('Beta Test Bay');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('beta-disposable-remote')!).inventoryEntries.length)).toBe(2);
    expect(pageErrors).toEqual([]);
  });
}
