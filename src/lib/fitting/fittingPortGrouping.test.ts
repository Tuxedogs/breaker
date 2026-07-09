import assert from "node:assert/strict";
import test from "node:test";
import type { PortBreakdownRow } from "./fittingPortGrouping.ts";
import {
  offensiveGroupKey,
  portCompatibilitySignature,
  summarizeGroupRows,
} from "./fittingPortGrouping.ts";

function weaponRow(overrides: Partial<PortBreakdownRow> = {}): PortBreakdownRow {
  return {
    shipKey: "ship-1",
    portId: "hardpoint_gun_nose/hardpoint_class_3",
    portName: "hardpoint_class_3",
    portType: "WeaponGun",
    portSubtype: "Gun",
    portCategory: "weapon",
    ruleCategory: "weapon",
    parentPortId: "hardpoint_gun_nose",
    childPortIds: [],
    equippedComponentKey: "weapon-1",
    equippedComponentName: "Repeater S3",
    componentCategory: "ship_weapon",
    componentManufacturer: null,
    componentSize: 3,
    portExactSize: null,
    portMinSize: null,
    portMaxSize: 3,
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

test("standalone nose guns group under pilot-weapons, not turret groups", () => {
  const left = weaponRow({
    portId: "hardpoint_gun_nose/hardpoint_class_3_left",
    parentPortId: "hardpoint_gun_nose",
  });
  const right = weaponRow({
    portId: "hardpoint_gun_nose/hardpoint_class_3_right",
    parentPortId: "hardpoint_gun_nose",
  });
  const lookup = new Map([left, right].map((row) => [row.portId, row]));

  assert.equal(offensiveGroupKey(left, lookup), "pilot-weapons");
  assert.equal(offensiveGroupKey(right, lookup), "pilot-weapons");
});

test("pilot weapon summaries use compatibility signature keys with real port ids", () => {
  const row = weaponRow();
  const [summary] = summarizeGroupRows([row], "pilot-weapons");

  assert.notEqual(summary.key, row.portId);
  assert.deepEqual(summary.portIds, [row.portId]);
  assert.equal(summary.turretLabel, null);
});

test("mixed turret child ports split into separate subgroup rows", () => {
  const turretRoot = "hardpoint_turret_main_gun_1";
  const bespoke = weaponRow({
    portId: `${turretRoot}/turret_left/hardpoint_class_8`,
    parentPortId: `${turretRoot}/turret_left`,
    equippedComponentName: "Medusa Cannon",
    equippedComponentKey: "medusa-1",
    componentSize: 8,
    bespoke: true,
    locked: true,
    editable: false,
  });
  const selectable = weaponRow({
    portId: `${turretRoot}/hardpoint_class_3_top`,
    parentPortId: turretRoot,
    equippedComponentName: "Empty",
    equippedComponentKey: null,
    componentSize: 3,
    editable: true,
    bespoke: false,
    locked: false,
  });
  const selectableTwin = weaponRow({
    ...selectable,
    portId: `${turretRoot}/hardpoint_class_3_top_2`,
  });
  const turretParent = weaponRow({
    portId: turretRoot,
    portType: "TurretBase",
    portSubtype: "MannedTurret",
    parentPortId: null,
    equippedComponentKey: null,
    equippedComponentName: null,
    componentCategory: null,
  });
  const lookup = new Map(
    [bespoke, selectable, selectableTwin, turretParent].map((row) => [row.portId, row]),
  );
  const summaries = summarizeGroupRows([bespoke, selectable, selectableTwin], "manned-turrets", lookup);

  assert.equal(summaries.length, 2);

  const bespokeSummary = summaries.find((summary) => summary.rows.some((row) => row.bespoke));
  const selectableSummary = summaries.find((summary) => summary.rows.every((row) => !row.bespoke));

  assert.ok(bespokeSummary);
  assert.ok(selectableSummary);
  assert.equal(bespokeSummary.quantity, 1);
  assert.equal(selectableSummary.quantity, 2);
  assert.equal(bespokeSummary.turretLabel, selectableSummary.turretLabel);
  assert.notEqual(bespokeSummary.key, selectableSummary.key);
});

test("portCompatibilitySignature distinguishes bespoke locked ports from selectable ports", () => {
  const bespoke = weaponRow({ bespoke: true, locked: true, editable: false });
  const selectable = weaponRow({ bespoke: false, locked: false, editable: true });

  assert.notEqual(portCompatibilitySignature(bespoke), portCompatibilitySignature(selectable));
});
