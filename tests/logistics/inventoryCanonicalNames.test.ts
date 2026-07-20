import assert from 'node:assert/strict';
import test from 'node:test';

import { materialTemplates, rarityCatalog } from '../../src/data/logistics/seed';
import { resolveInventoryItemName } from '../../src/lib/logistics/inventory';
import type { InventoryEntry } from '../../src/types/logistics';

const material = (id: string) => {
  const match = materialTemplates.find((entry) => entry.id === id);
  assert.ok(match, `missing material fixture ${id}`);
  return match;
};

const entry = (input: Partial<InventoryEntry>): InventoryEntry => ({
  id: 'inventory-name-test',
  quantity: 1,
  rarity: rarityCatalog.common,
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
  ...input,
});

test('known hand-minables ignore stale lowercase persisted item names', () => {
  assert.equal(resolveInventoryItemName(entry({ itemName: 'hadanite' }), material('hadanite')), 'Hadanite');
});

test('the stable rawice key only surfaces Pressurized Ice in active inventory', () => {
  assert.equal(resolveInventoryItemName(entry({ itemName: 'Ice', itemKind: 'refined' }), material('rawice')), 'Pressurized Ice');
  assert.equal(resolveInventoryItemName(entry({ itemName: 'Raw Ice', itemKind: 'ore' }), material('rawice')), 'Pressurized Ice');
});
