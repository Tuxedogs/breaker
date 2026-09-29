import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getInventoryRecordPresentation,
  getInventoryTransferPresentation,
} from "../../src/components/logistics/inventoryRecordPresentation";
import { inventoryLayoutFixture } from "../../src/pages/logistics/inventoryLayoutFixture";

describe("Inventory workspace record-kind presentation", () => {
  it("reserves physical-box identity for explicit box records", () => {
    assert.deepEqual(getInventoryRecordPresentation({ recordKind: "box" }), {
      isPhysicalBox: true,
      label: "Physical box",
      moveNoun: "physical box",
    });
  });

  it("labels explicit and omitted legacy aggregate records without fake container identity", () => {
    for (const entry of [{ recordKind: "aggregate" as const }, { recordKind: undefined }]) {
      assert.deepEqual(getInventoryRecordPresentation(entry), {
        isPhysicalBox: false,
        label: "Aggregate stock",
        moveNoun: "aggregate stock record",
      });
    }

    const aggregateFixture = inventoryLayoutFixture.entries.find((entry) => entry.id === "fixture-levski-tungsten");
    assert.equal(aggregateFixture?.recordKind, "aggregate");
    assert.equal(aggregateFixture?.container, undefined);
    assert.equal(aggregateFixture?.boxSize, undefined);
  });

  it("uses record-aware transfer language for box, aggregate, and mixed selections", () => {
    assert.deepEqual(getInventoryTransferPresentation([{ recordKind: "box" }]), {
      title: "Move physical boxes",
      selectionNoun: "lot",
    });
    assert.deepEqual(getInventoryTransferPresentation([{ recordKind: "aggregate" }, {}]), {
      title: "Move aggregate stock",
      selectionNoun: "record",
    });
    assert.deepEqual(getInventoryTransferPresentation([{ recordKind: "box" }, { recordKind: "aggregate" }]), {
      title: "Move inventory records",
      selectionNoun: "record",
    });
  });
});
