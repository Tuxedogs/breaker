import assert from 'node:assert/strict';
import test from 'node:test';

import { rarityCatalog } from '../../src/data/logistics/seed';
import {
  createInventoryEntryDraft,
  mergeInventoryEntries,
  repairInventoryEntryIds,
  useLogisticsStore,
} from '../../src/stores/logisticsStore';
import {
  getInventoryInsertId,
  shouldFallbackMergeInventoryRecord,
} from '../../src/server/user/onlinePersistenceService';
import type { InventoryEntry } from '../../src/types/logistics';

const timestamp = '2026-07-16T12:00:00.000Z';
const boxIds = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
];

function entry(input: Pick<InventoryEntry, 'id' | 'quantity'> & Partial<InventoryEntry>): InventoryEntry {
  return createInventoryEntryDraft({
    materialId: 'stileron',
    materialName: 'Stileron',
    itemName: 'Stileron',
    itemKind: 'refined',
    unitType: 'scu',
    quality: 937,
    locationId: 'orbituary',
    rarity: rarityCatalog.legendary,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...input,
  });
}

test('discrete boxes retain distinct IDs through add and repair while totals remain derived', () => {
  const boxes = [
    entry({ id: boxIds[0], recordKind: 'box', quantity: 1, boxSize: 1 }),
    entry({ id: boxIds[1], recordKind: 'box', quantity: 0.74, boxSize: 0.74 }),
    entry({ id: boxIds[2], recordKind: 'box', quantity: 0.32, boxSize: 0.32 }),
  ];

  const added = mergeInventoryEntries([], boxes, useLogisticsStore.getState().materialTemplates);
  assert.equal(added.length, 3);
  assert.deepEqual(added.map((item) => item.id), boxIds);
  assert.equal(added.reduce((sum, item) => sum + item.quantity, 0), 2.06);

  const reloaded = repairInventoryEntryIds(added.map((item) => ({ ...item })));
  assert.equal(reloaded.length, 3);
  assert.deepEqual(reloaded.map((item) => item.id), boxIds);

  const idempotent = mergeInventoryEntries(added, [{ ...boxes[0], quantity: 1 }], useLogisticsStore.getState().materialTemplates);
  assert.equal(idempotent.length, 3);
  assert.equal(idempotent.find((item) => item.id === boxIds[0])?.quantity, 1);
});

test('legacy aggregate entries retain metadata aggregation behavior', () => {
  const repaired = repairInventoryEntryIds([
    entry({ id: 'legacy-a', quantity: 1 }),
    entry({ id: 'legacy-b', quantity: 0.74 }),
  ]);

  assert.equal(repaired.length, 1);
  assert.equal(repaired[0].id, 'legacy-a');
  assert.equal(repaired[0].quantity, 1.74);
});

test('server box upserts preserve UUID identity and skip metadata fallback', () => {
  const box = { id: boxIds[0], recordKind: 'box', materialId: 'stileron', quality: 937 };
  assert.equal(shouldFallbackMergeInventoryRecord(box), false);
  assert.equal(getInventoryInsertId(box), boxIds[0]);

  const aggregate = { id: 'legacy-a', materialId: 'stileron', quality: 937 };
  assert.equal(shouldFallbackMergeInventoryRecord(aggregate), true);
  assert.equal(getInventoryInsertId(aggregate), undefined);
});

test('inventory box quality accepts the modal range boundary of zero', () => {
  const zeroQuality = entry({ id: boxIds[0], recordKind: 'box', quantity: 1, quality: 0 });
  assert.equal(zeroQuality.quality, 0);
});
