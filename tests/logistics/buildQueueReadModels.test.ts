import assert from 'node:assert/strict';
import test from 'node:test';

import { materialTemplates, rarityCatalog } from '../../src/data/logistics/seed';
import type { RecipeInputTemplate } from '../../src/data/logistics/seed';
import {
  getBuildQueueItemAllocationProgress,
  getBuildQueueItemAllocationSummary,
} from '../../src/lib/logistics/buildQueueProgress';
import { getQueueLedgerModel } from '../../src/lib/logistics/queueLedger';
import { computePhysicalAvailabilityShortages } from '../../src/lib/logistics/shortages';
import type { BuildQueueItem, InventoryEntry, ReservedMaterialAllocation } from '../../src/types/logistics';

const createdAt = '2026-08-28T00:00:00.000Z';

function inventoryLot(id: string, quantity: number, quality: number, itemKind: InventoryEntry['itemKind'] = 'refined'): InventoryEntry {
  return {
    id,
    materialId: 'stileron',
    materialName: 'Stileron',
    itemName: 'Stileron',
    materialType: itemKind === 'ore' ? 'ore' : 'refined',
    itemKind,
    unitType: 'scu',
    quantity,
    quality,
    rarity: rarityCatalog.common,
    createdAt,
    updatedAt: createdAt,
  };
}

function allocation(
  id: string,
  inventoryEntryId: string,
  quantityReserved: number,
  requirementId = 'req-stileron',
  quality = 900,
): ReservedMaterialAllocation {
  return {
    id,
    inventoryEntryId,
    materialId: 'stileron',
    quantityReserved,
    requirementId,
    quality,
    unitType: 'scu',
    rarity: rarityCatalog.common,
  };
}

function queueItem(id: string, reservedAllocations: ReservedMaterialAllocation[] = []): BuildQueueItem {
  return {
    id,
    entryKind: 'instance',
    queueId: 'queue-a',
    recipeId: 'same-recipe',
    quantity: 1,
    status: 'active',
    priority: 1,
    reservedAllocations,
  };
}

const inputs: RecipeInputTemplate[] = [{
  requirementId: 'req-stileron',
  materialId: 'stileron',
  materialKey: 'stileron',
  materialName: 'Stileron',
  quantity: 10,
  selectedQuality: 800,
  unitType: 'scu',
}];

test('Ready, Partial, and Missing all derive from valid physical allocation coverage', () => {
  const inventory = [inventoryLot('lot-a', 10, 900)];
  assert.deepEqual(getBuildQueueItemAllocationSummary(queueItem('missing'), inputs, inventory), {
    basis: 'valid-physical-lot-allocation',
    fulfillment: 'missing',
    progressPercent: 0,
  });
  assert.deepEqual(getBuildQueueItemAllocationSummary(
    queueItem('partial', [allocation('partial-allocation', 'lot-a', 4)]),
    inputs,
    inventory,
  ), {
    basis: 'valid-physical-lot-allocation',
    fulfillment: 'partial',
    progressPercent: 40,
  });
  assert.deepEqual(getBuildQueueItemAllocationSummary(
    queueItem('ready', [allocation('ready-allocation', 'lot-a', 10)]),
    inputs,
    inventory,
  ), {
    basis: 'valid-physical-lot-allocation',
    fulfillment: 'ready',
    progressPercent: 100,
  });
});

test('allocation progress excludes owned but unallocated stock and stale allocations', () => {
  const ownedInventory = [inventoryLot('lot-a', 10, 900)];
  assert.equal(getBuildQueueItemAllocationProgress(queueItem('owned-only'), { 'same-recipe': inputs }, ownedInventory), 0);
  assert.equal(getBuildQueueItemAllocationProgress(
    queueItem('stale', [allocation('stale-allocation', 'missing-lot', 10)]),
    { 'same-recipe': inputs },
    ownedInventory,
  ), 0);
});

test('reservations and competing duplicate recipe instances consume physical stock once', () => {
  const sharedInventory = [inventoryLot('shared-lot', 10, 900)];
  const sixUnitInputs = [{ ...inputs[0], quantity: 6 }];
  const first = queueItem('instance-a', [allocation('allocation-a', 'shared-lot', 6)]);
  const second = queueItem('instance-b');
  const shortages = computePhysicalAvailabilityShortages(sharedInventory, [first, second], { 'same-recipe': sixUnitInputs });

  assert.equal(shortages.length, 1);
  assert.equal(shortages[0]?.needed, 12);
  assert.equal(shortages[0]?.allocated, 6);
  assert.equal(shortages[0]?.available, 4);
  assert.equal(shortages[0]?.shortfall, 2);
  assert.equal(getBuildQueueItemAllocationProgress(first, { 'same-recipe': sixUnitInputs }, sharedInventory), 100);
  assert.equal(getBuildQueueItemAllocationProgress(second, { 'same-recipe': sixUnitInputs }, sharedInventory), 0);
});

test('quality-limited stock is not treated as available unless lower quality is allowed', () => {
  const lowQualityInventory = [inventoryLot('low-lot', 10, 700)];
  const strict = queueItem('strict');
  const strictShortages = computePhysicalAvailabilityShortages(lowQualityInventory, [strict], { 'same-recipe': inputs });
  assert.equal(strictShortages[0]?.available, 0);
  assert.equal(strictShortages[0]?.shortfall, 10);

  const lowerQualityAllowed = { ...queueItem('lower-ok'), allowLowerQuality: true };
  assert.deepEqual(computePhysicalAvailabilityShortages(lowQualityInventory, [lowerQualityAllowed], { 'same-recipe': inputs }), []);
});

test('raw/refined queue planning remains explicitly distinct from physical shortage availability', () => {
  const rawInventory = [inventoryLot('raw-lot', 10, 900, 'ore')];
  const item = queueItem('planning-item');
  const planning = getQueueLedgerModel({
    buildQueue: [item],
    inventoryEntries: rawInventory,
    materials: materialTemplates,
    recipeInputsByRecipeId: { 'same-recipe': inputs },
  });
  const physicalShortages = computePhysicalAvailabilityShortages(rawInventory, [item], { 'same-recipe': inputs });

  assert.equal(planning.basis, 'owned-stock-raw-refined-planning-equivalent');
  assert.equal(planning.lines[0]?.refinedEquivalentFromOre, 4);
  assert.equal(planning.lines[0]?.netMissingRefined, 6);
  assert.deepEqual(physicalShortages, []);
});
