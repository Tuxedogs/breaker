import assert from 'node:assert/strict';
import test from 'node:test';

import { rarityCatalog } from '../../src/data/logistics/seed';
import {
  createBuildQueueCompletionSnapshot,
  createBuildQueueEntryId,
  getCompletedPresentationItem,
  getActiveBuildQueueEntries,
  moveActiveQueueEntry,
  reorderActiveQueueEntries,
} from '../../src/lib/logistics/buildQueueEntries';
import {
  getBuildQueueInsertId,
  shouldFallbackMergeBuildQueueRecord,
} from '../../src/server/user/onlinePersistenceService';
import { useLogisticsStore } from '../../src/stores/logisticsStore';
import type { BuildQueueItem } from '../../src/types/logistics';

const queueA = 'queue-a';
const queueB = 'queue-b';

function entry(id: string, priority: number, queueId = queueA): BuildQueueItem {
  return {
    id,
    entryKind: 'instance',
    queueId,
    recipeId: 'same-recipe',
    itemName: 'FR-66',
    quantity: 1,
    priority,
    status: 'active',
    materialRequirements: [{
      requirementId: 'same-recipe:stileron',
      materialId: 'stileron',
      materialKey: 'stileron',
      quantity: 0.5,
      selectedQuality: 800 + priority * 10,
    }],
    reservedAllocations: [{
      id: `allocation-${id}`,
      materialId: 'stileron',
      inventoryEntryId: `box-${id}`,
      quantityReserved: 0.5,
      quality: 900 - priority,
      rarity: rarityCatalog.legendary,
    }],
  };
}

test('adding the same recipe creates independent queue entry identities', () => {
  const original = useLogisticsStore.getState();
  try {
    useLogisticsStore.setState({
      buildQueues: [{ id: queueA, name: 'Queue A', sourceType: 'custom' }],
      activeBuildQueueId: queueA,
      buildQueue: [],
    });
    const add = useLogisticsStore.getState().addBuildQueueItem;
    add('same-recipe', 1, { itemName: 'FR-66' });
    add('same-recipe', 1, { itemName: 'FR-66' });
    add('same-recipe', 1, { itemName: 'FR-66' });

    const added = useLogisticsStore.getState().buildQueue;
    assert.equal(added.length, 3);
    assert.equal(new Set(added.map((item) => item.id)).size, 3);
    assert.ok(added.every((item) => item.entryKind === 'instance'));
    assert.ok(added.every((item) => item.quantity === 1));
  } finally {
    useLogisticsStore.setState(original, true);
  }
});

test('reorder and cross-queue moves use entry IDs without merging duplicate recipes', () => {
  const items = [entry('one', 1), entry('two', 2), entry('three', 3)];
  const reordered = reorderActiveQueueEntries(items, queueA, ['three', 'one', 'two']);
  assert.deepEqual(
    reordered.filter((item) => item.queueId === queueA).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)).map((item) => item.id),
    ['three', 'one', 'two'],
  );

  const moved = moveActiveQueueEntry(reordered, 'one', queueB, 0);
  assert.equal(moved.length, 3);
  assert.equal(moved.find((item) => item.id === 'one')?.queueId, queueB);
  assert.deepEqual(moved.filter((item) => item.queueId === queueA).map((item) => item.id).sort(), ['three', 'two']);
});

test('completed presentation snapshot freezes allocation and target values', () => {
  const active = entry('completed', 1);
  const snapshot = createBuildQueueCompletionSnapshot(active, '2026-07-17T12:00:00.000Z');
  const completed: BuildQueueItem = { ...active, status: 'complete', completionSnapshot: snapshot };
  active.materialRequirements![0].selectedQuality = 300;
  active.reservedAllocations![0].quality = 100;

  const displayed = getCompletedPresentationItem(completed);
  assert.equal(displayed.materialRequirements?.[0].selectedQuality, 810);
  assert.equal(displayed.reservedAllocations?.[0].quality, 899);
});

test('server sync only metadata-merges legacy queue records', () => {
  const id = createBuildQueueEntryId();
  const instance = { id, entryKind: 'instance', recipeId: 'same-recipe' };
  assert.equal(shouldFallbackMergeBuildQueueRecord(instance), false);
  assert.equal(getBuildQueueInsertId(instance), id);
  assert.equal(shouldFallbackMergeBuildQueueRecord({ id: 'legacy', recipeId: 'same-recipe' }), true);
});

test('dashboard queue selection never falls back to completed entries', () => {
  const completed = { ...entry('done', 1), status: 'complete' as const };
  assert.deepEqual(getActiveBuildQueueEntries([completed]), []);
  assert.deepEqual(getActiveBuildQueueEntries([completed, entry('active', 2)]).map((item) => item.id), ['active']);
});
