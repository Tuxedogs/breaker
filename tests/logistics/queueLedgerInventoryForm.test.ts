import assert from 'node:assert/strict';
import test from 'node:test';

import { materialTemplates, rarityCatalog } from '../../src/data/logistics/seed';
import { getQueueLedgerModel } from '../../src/lib/logistics/queueLedger';
import type { InventoryEntry } from '../../src/types/logistics';

const inventoryEntry = (id: string, itemKind: InventoryEntry['itemKind']): InventoryEntry => ({
  id,
  materialId: 'rawice',
  materialName: itemKind === 'ore' ? 'Raw Ice' : 'Pressurized Ice',
  itemName: itemKind === 'ore' ? 'Raw Ice' : 'Pressurized Ice',
  materialType: itemKind === 'ore' ? 'ore' : 'refined',
  itemKind,
  unitType: 'scu',
  quantity: 4,
  rarity: rarityCatalog.common,
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
});

test('separates refined Pressurized Ice from explicitly raw Ice inventory', () => {
  const model = getQueueLedgerModel({
    buildQueue: [{
      id: 'queue-item',
      recipeId: 'ice-recipe',
      quantity: 1,
      status: 'active',
      materialRequirements: [{ materialId: 'rawice', materialName: 'Pressurized Ice', quantity: 10, unitType: 'SCU' }],
    }],
    inventoryEntries: [inventoryEntry('refined-ice', 'refined'), inventoryEntry('raw-ice', 'ore')],
    materials: materialTemplates,
    recipeInputsByRecipeId: {},
  });

  assert.equal(model.lines.length, 1);
  assert.equal(model.lines[0]?.availableRefined, 4);
  assert.equal(model.lines[0]?.rawOreAvailable, 4);
  assert.equal(model.lines[0]?.refinedEquivalentFromOre, 1.6);
});
