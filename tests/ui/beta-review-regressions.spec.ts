import { expect, test, type Page } from '@playwright/test';

// A synthetic localhost account exercises the real route and auth coordinator.
// These checks make no claim about live backend persistence or permissions.
async function useLocalAccount(page: Page) {
  const user = {
    id: '00000000-0000-4000-8000-000000000048', aud: 'authenticated',
    role: 'authenticated', email: 'pr48@example.invalid',
    app_metadata: { provider: 'discord', providers: ['discord'] },
    user_metadata: { full_name: 'PR48 Fixture' }, created_at: '2026-10-23T00:00:00Z',
  };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const accessToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: 4102444800, aud: 'authenticated', role: 'authenticated' })}.fixture`;
  const remote = {
      locations: [{ id: 'area18', name: 'Area18', system: 'Stanton', source: 'canonical' }],
      inventoryEntries: [{ id: 'pr48-iron-box', recordKind: 'box', materialId: 'iron', materialType: 'refined', itemName: 'Iron', quantity: 2, quality: 900, unitType: 'scu', locationId: 'area18', createdAt: '2026-10-23T00:00:00Z', updatedAt: '2026-10-23T00:00:00Z' }],
      buildQueues: [], buildQueue: [], sync: { migratedAt: '2026-10-23T00:00:00Z' },
  };
  // Intercept before the development fixture service worker, which can otherwise
  // serve these requests without reaching Playwright's network route handlers.
  await page.addInitScript(({ session, remote }) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify(session));
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.origin);
      if (url.pathname.startsWith('/api/user/') || url.pathname.startsWith('/auth/v1/')) {
        return new Response(JSON.stringify(url.pathname.startsWith('/auth/v1/') ? session.user : remote), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      return original(input, init);
    };
  }, { session: { access_token: accessToken, refresh_token: 'fixture-only', token_type: 'bearer', expires_at: 4102444800, expires_in: 36000000, user }, remote });
}

test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
});

for (const viewport of [{ width: 1920, height: 1080 }, { width: 2560, height: 1440 }, { width: 768, height: 900 }, { width: 390, height: 844 }]) {
  test(`direct Inventory Add has its own modal geometry at ${viewport.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await useLocalAccount(page);
    await page.goto('/logistics/inventory', { waitUntil: 'domcontentloaded' });
    const add = page.getByRole('button', { name: 'Add Item', exact: true });
    await expect(add).toBeEnabled();
    await add.click();
    const dialog = page.getByRole('dialog', { name: 'Add Inventory' });
    await expect(dialog).toBeVisible();
    await expect(page.locator('.bq-inv-quick-backdrop')).toHaveCSS('position', 'fixed');
    const rect = await dialog.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect!.x).toBeGreaterThanOrEqual(0);
    expect(rect!.y).toBeGreaterThanOrEqual(0);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(viewport.width);
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(viewport.height);
    await dialog.getByRole('button', { name: 'Change', exact: true }).click();
    await dialog.getByPlaceholder('Search all locations...').fill('Area18');
    const option = dialog.getByRole('button', { name: /Area18/ });
    await expect(option).toHaveCSS('display', 'flex');
    await option.click();
    await expect(dialog.locator('.bq-inv-add-location-value strong')).toHaveText('Area18');
    await page.screenshot({ path: testInfo.outputPath('inventory-direct.png') });
    await dialog.getByRole('button', { name: 'Close add inventory' }).click();
    await expect(dialog).toBeHidden();
    // A fresh direct load exercises route-owned CSS, without visiting Build Queue.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(add).toBeEnabled();
    await add.click();
    await expect(page.locator('.bq-inv-quick-backdrop')).toHaveCSS('position', 'fixed');
  });

  test(`Build Queue target, blueprint and planning labels fit at ${viewport.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/logistics/build-queue/__fixture/stats?mockup=1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.bq-component-statistics[data-bq-stats-status="ready"]')).toBeVisible();
    const header = page.locator('.bq-selected-craft-card');
    const target = page.locator('.bq-selected-target-quality');
    await expect(target).toBeVisible();
    const headerBounds = await header.boundingBox();
    const targetBounds = await target.boundingBox();
    expect(targetBounds!.x + targetBounds!.width).toBeLessThanOrEqual(headerBounds!.x + headerBounds!.width);
    if (viewport.width <= 768) {
      await expect(page.locator('.bq-item-blueprint, .bq-item-blueprint-links').first()).toHaveCSS('white-space', 'normal');
    }
    await header.screenshot({ path: testInfo.outputPath('selected-craft.png') });
    const toggle = page.locator('.bq-inventory-toggle');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    const groups = page.locator('.bq-item--inventory-off .bq-mat-group');
    for (const group of await groups.all()) {
      await group.scrollIntoViewIfNeeded();
      const labels = group.locator('.bq-target-slider-marker span');
      const boxes = await labels.evaluateAll(nodes => nodes.map(n => {
        const { x, y, width, height } = n.getBoundingClientRect();
        return { x, y, width, height };
      }));
      if (viewport.width <= 768) {
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i]; const b = boxes[j];
            expect(a.x >= b.x + b.width || b.x >= a.x + a.width || a.y >= b.y + b.height || b.y >= a.y + a.height).toBe(true);
          }
        }
      }
    }
    const slider = groups.first().getByRole('slider', { name: /Target quality for/ });
    await slider.focus();
    const before = await slider.inputValue();
    await page.keyboard.press('ArrowLeft');
    expect(await slider.inputValue()).not.toBe(before);
    if (viewport.width <= 768) {
      const track = (await slider.boundingBox())!;
      const amount = (await groups.first().locator('.bq-mat-allocation-summary').boundingBox())!;
      expect(amount.y + amount.height).toBeLessThan(track.y);
      for (const label of await groups.first().locator('.bq-target-slider-marker span').all()) {
        const box = (await label.boundingBox())!;
        // Include the keyboard outline and its offset, not just the input box.
        expect(box.y).toBeGreaterThanOrEqual(track.y + track.height + 4);
      }
    }
    await groups.first().screenshot({ path: testInfo.outputPath('planning-labels.png') });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
}
