import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_BUILD_QUEUE_ID,
  normalizeBuildQueueState,
} from "./buildQueues";
import type { BuildQueueItem } from "../../types/logistics";
import { rarityCatalog } from "../../data/logistics/seed";

function item(id: string, queueId?: string): BuildQueueItem {
  return {
    id,
    queueId,
    recipeId: `recipe-${id}`,
    quantity: 1,
    materialRequirements: [{
      requirementId: `${id}:material`,
      materialId: "stileron",
      quantity: 0.25,
      selectedQuality: 860,
      rarity: rarityCatalog.legendary,
    }],
    reservedAllocations: [{
      id: `${id}:allocation`,
      inventoryEntryId: "inventory-1",
      materialId: "stileron",
      quantityReserved: 0.25,
      requirementId: `${id}:material`,
    }],
  };
}

describe("normalizeBuildQueueState", () => {
  it("migrates legacy items into a default queue without changing item state", () => {
    const legacyItem = item("legacy");
    const normalized = normalizeBuildQueueState({ items: [legacyItem] });

    assert.equal(normalized.queues.length, 1);
    assert.equal(normalized.queues[0].id, DEFAULT_BUILD_QUEUE_ID);
    assert.equal(normalized.queues[0].name, "Default Queue");
    assert.equal(normalized.items[0].queueId, DEFAULT_BUILD_QUEUE_ID);
    assert.deepEqual(normalized.items[0].materialRequirements, legacyItem.materialRequirements);
    assert.deepEqual(normalized.items[0].reservedAllocations, legacyItem.reservedAllocations);
  });

  it("keeps queue-specific items and selects a sensible fallback", () => {
    const normalized = normalizeBuildQueueState({
      queues: [
        { id: "queue-a", name: "Queue A", sourceType: "custom" },
        { id: "queue-b", name: "Queue B", sourceType: "fitting", sourceReference: "fit-1" },
      ],
      items: [item("a", "queue-a"), item("b", "queue-b")],
      activeQueueId: "deleted-queue",
    });

    assert.equal(normalized.activeQueueId, "queue-a");
    assert.equal(normalized.items[0].queueId, "queue-a");
    assert.equal(normalized.items[1].queueId, "queue-b");
    assert.equal(normalized.queues[1].sourceType, "fitting");
    assert.equal(normalized.queues[1].sourceReference, "fit-1");
  });
});
