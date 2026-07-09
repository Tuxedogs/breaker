import assert from "node:assert/strict";
import test from "node:test";
import {
  getFittingItemSize,
  getFittingPortSizeConstraint,
  isFittingItemBespoke,
  isFittingItemInstallableForPort,
  isItemSizeCompatibleWithPort,
  parseNumericSize,
  portHasKnownSizeConstraint,
} from "./fittingItemConstraints.ts";
import type { FittingComponentSummary } from "./fittingApi.ts";
import type { PortBreakdownRow } from "./fittingPortGrouping.ts";
import {
  buildSlotCompatibilityIndex,
  isItemCompatibleWithSlot,
  resolveCompatibleItemsForSlot,
  type SlotCompatibilityIndex,
} from "./fittingSlotCompatibility.ts";

function baseSlot(overrides: Partial<PortBreakdownRow> = {}): PortBreakdownRow {
  return {
    shipKey: "ship-1",
    portId: "hardpoint_gun_left_wing/hardpoint_class_3",
    portName: "hardpoint_class_3",
    portType: "WeaponGun",
    portSubtype: "Gun",
    portCategory: "weapon",
    ruleCategory: "weapon",
    parentPortId: "hardpoint_gun_left_wing",
    childPortIds: [],
    equippedComponentKey: "weapon-installed",
    equippedComponentName: "Installed Repeater",
    componentCategory: "ship_weapon",
    componentManufacturer: null,
    componentSize: 3,
    portExactSize: null,
    portMinSize: null,
    portMaxSize: null,
    componentSubtype: "Gun",
    compatibilityStatus: "known",
    editable: true,
    bespoke: false,
    locked: false,
    warnings: [],
    confidence: "high",
    ...overrides,
  };
}

function component(overrides: Partial<FittingComponentSummary> = {}): FittingComponentSummary {
  return {
    id: "component-1",
    name: "Repeater_S3",
    displayName: "Repeater S3",
    manufacturer: null,
    type: "ship_weapon",
    subtype: "Gun",
    size: 3,
    grade: "A",
    class: "civilian",
    confidence: "high",
    ...overrides,
  };
}

function knownIndex(
  slot: PortBreakdownRow,
  components: FittingComponentSummary[],
  constraint: SlotCompatibilityIndex["constraint"] = {
    type: "WeaponGun",
    subtype: "Gun",
    minSize: null,
    maxSize: null,
    exactSize: null,
    bespoke: false,
    editable: true,
  },
): SlotCompatibilityIndex {
  return buildSlotCompatibilityIndex(slot, {
    shipId: slot.shipKey,
    portId: slot.portId,
    status: "known",
    constraint,
    components,
  });
}

test("parseNumericSize normalizes labeled sizes", () => {
  assert.equal(parseNumericSize("S3"), 3);
  assert.equal(parseNumericSize("Size 2"), 2);
  assert.equal(parseNumericSize(4), 4);
});

test("getFittingItemSize prefers size then attachSize", () => {
  assert.equal(getFittingItemSize({ size: 2, attachSize: 3 }), 2);
  assert.equal(getFittingItemSize({ attachSize: 3 }), 3);
  assert.equal(getFittingItemSize({ fitting: { attachSize: 1 } }), 1);
});

test("getFittingPortSizeConstraint uses installed component size before port identity", () => {
  const slot = baseSlot({ componentSize: 3, portId: "hardpoint_gun_left_wing/hardpoint_class_2" });
  const constraint = getFittingPortSizeConstraint(slot, null);
  assert.equal(constraint.exactSize, 3);
  assert.ok(constraint.sources.includes("slot.componentSize"));
});

test("isItemSizeCompatibleWithPort fails closed when item size is missing", () => {
  const slot = baseSlot({ componentSize: 3 });
  const verdict = isItemSizeCompatibleWithPort(slot, { type: "ship_weapon" }, null);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, "size_missing");
});

test("isItemSizeCompatibleWithPort enforces exact size", () => {
  const slot = baseSlot({ componentSize: 3 });
  const ok = isItemSizeCompatibleWithPort(slot, component({ size: 3 }), null);
  const bad = isItemSizeCompatibleWithPort(slot, component({ id: "s4", size: 4 }), null);
  assert.equal(ok.ok, true);
  assert.equal(bad.ok, false);
  assert.equal(bad.code, "size_exact_mismatch");
});

test("isFittingItemBespoke detects internal item names", () => {
  assert.equal(isFittingItemBespoke(component({ name: "Krig_LaserRepeater_Bespoke_S4" })), true);
  assert.equal(isFittingItemBespoke(component({ name: "Repeater_S3" })), false);
});

test("weapon port rejects shield candidate by type and list", () => {
  const slot = baseSlot({ portType: "WeaponGun", componentSize: 3 });
  const weapon = component({ id: "weapon-1", type: "ship_weapon", size: 3 });
  const shield = component({ id: "shield-1", type: "shield", size: 3, displayName: "Shield" });
  const index = knownIndex(slot, [weapon, shield], {
    type: "WeaponGun",
    subtype: "Gun",
    minSize: null,
    maxSize: null,
    exactSize: null,
    bespoke: false,
    editable: true,
  });

  assert.equal(isItemCompatibleWithSlot({ slot, item: weapon, compatibilityIndex: index }).compatible, true);
  assert.equal(isItemCompatibleWithSlot({ slot, item: shield, compatibilityIndex: index }).compatible, false);
});

test("shield port rejects weapon candidate", () => {
  const slot = baseSlot({
    portId: "hardpoint_shield_generator_left",
    portType: "Shield",
    componentSize: 1,
    componentCategory: "shield",
  });
  const shield = component({ id: "shield-1", type: "shield", size: 1 });
  const weapon = component({ id: "weapon-1", type: "ship_weapon", size: 1 });
  const index = knownIndex(slot, [shield, weapon], {
    type: "Shield",
    subtype: null,
    minSize: null,
    maxSize: null,
    exactSize: null,
    bespoke: false,
    editable: true,
  });

  assert.equal(isItemCompatibleWithSlot({ slot, item: shield, compatibilityIndex: index }).compatible, true);
  assert.equal(isItemCompatibleWithSlot({ slot, item: weapon, compatibilityIndex: index }).compatible, false);
});

test("cooler port rejects power plant candidate", () => {
  const slot = baseSlot({
    portId: "Hardpoint_cooler_left",
    portType: "Cooler",
    componentSize: 1,
    componentCategory: "cooler",
  });
  const cooler = component({ id: "cooler-1", type: "cooler", size: 1, displayName: "Cooler" });
  const power = component({ id: "power-1", type: "power_plant", size: 1, displayName: "Plant" });
  const index = knownIndex(slot, [cooler, power], {
    type: "Cooler",
    subtype: null,
    minSize: null,
    maxSize: null,
    exactSize: null,
    bespoke: false,
    editable: true,
  });

  assert.equal(isItemCompatibleWithSlot({ slot, item: cooler, compatibilityIndex: index }).compatible, true);
  assert.equal(isItemCompatibleWithSlot({ slot, item: power, compatibilityIndex: index }).compatible, false);
});

test("known port with empty compatible list returns empty drawer results", () => {
  const slot = baseSlot();
  const index = buildSlotCompatibilityIndex(slot, {
    shipId: slot.shipKey,
    portId: slot.portId,
    status: "none",
    constraint: {
      type: "WeaponGun",
      subtype: "Gun",
      minSize: null,
      maxSize: null,
      exactSize: null,
      bespoke: false,
      editable: true,
    },
    components: [],
  });

  const resolved = resolveCompatibleItemsForSlot({
    slot,
    candidateItems: [component({ id: "weapon-1" })],
    compatibilityIndex: index,
  });
  assert.deepEqual(resolved, []);
});

test("unknown compatibility returns empty drawer results", () => {
  const slot = baseSlot();
  const index = buildSlotCompatibilityIndex(slot, {
    shipId: slot.shipKey,
    portId: slot.portId,
    status: "unknown",
    constraint: {
      type: "WeaponGun",
      subtype: null,
      minSize: null,
      maxSize: null,
      exactSize: null,
      bespoke: false,
      editable: true,
    },
    components: [component()],
  });

  const resolved = resolveCompatibleItemsForSlot({
    slot,
    candidateItems: [component()],
    compatibilityIndex: index,
  });
  assert.deepEqual(resolved, []);
});

test("resolveCompatibleItemsForSlot filters wrong-size and bespoke weapons", () => {
  const slot = baseSlot({ componentSize: 3 });
  const good = component({ id: "good", size: 3, name: "Repeater_S3" });
  const wrongSize = component({ id: "wrong-size", size: 4, displayName: "Too Large" });
  const bespoke = component({ id: "bespoke", size: 3, name: "Krig_LaserRepeater_Bespoke_S4", displayName: "Bespoke" });
  const index = knownIndex(slot, [good, wrongSize, bespoke]);

  const resolved = resolveCompatibleItemsForSlot({
    slot,
    candidateItems: [good, wrongSize, bespoke],
    compatibilityIndex: index,
  });

  assert.deepEqual(resolved.map((item) => item.id), ["good"]);
});

test("stale port response is ignored by index builder", () => {
  const slot = baseSlot();
  const index = buildSlotCompatibilityIndex(slot, {
    shipId: slot.shipKey,
    portId: "other-port",
    status: "known",
    constraint: {
      type: "WeaponGun",
      subtype: null,
      minSize: null,
      maxSize: null,
      exactSize: null,
      bespoke: false,
      editable: true,
    },
    components: [component()],
  }, false);

  assert.equal(index.status, "unavailable");
  assert.equal(portHasKnownSizeConstraint(getFittingPortSizeConstraint(slot, null)), true);
});

test("isFittingItemInstallableForPort rejects bespoke items", () => {
  const slot = baseSlot();
  const verdict = isFittingItemInstallableForPort(slot, component({ name: "ANVL_BallisticGatling_Bespoke" }));
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, "bespoke_item");
});
