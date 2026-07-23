import assert from "node:assert/strict";
import test from "node:test";
import type { PortBreakdownRow } from "./fittingPortGrouping.ts";
import { buildMockupOffensiveDisplayGroups } from "./fittingMockupGroups.ts";
import {
  buildOffensiveGroups,
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

test("source-backed ship weapon rockets group under rockets", () => {
  const rocket = weaponRow({
    portId: "hardpoint_gun_wing/hardpoint_class_2",
    parentPortId: "hardpoint_gun_wing",
    equippedComponentKey: "rocket-pod-1",
    equippedComponentName: "Jericho XL Rocket Pod",
    componentSubtype: "Rocket",
  });
  const lookup = new Map([[rocket.portId, rocket]]);

  assert.equal(offensiveGroupKey(rocket, lookup), "rockets");

  const rockets = buildOffensiveGroups([rocket]).find((group) => group.key === "rockets");
  assert.ok(rockets);
  assert.equal(rockets.label, "Rockets");
  assert.deepEqual(rockets.rows, [rocket]);
});

test("Rocket subtype does not reclassify standalone missile records", () => {
  const missile = weaponRow({
    portId: "missile_rack/rocket_01",
    parentPortId: "missile_rack",
    portType: "Missile",
    portCategory: "missile",
    ruleCategory: "missile",
    componentCategory: "missile",
    componentSubtype: "Rocket",
    equippedComponentKey: "rocket-1",
    equippedComponentName: "Venom Rocket",
  });
  const lookup = new Map([[missile.portId, missile]]);

  assert.equal(offensiveGroupKey(missile, lookup), "missiles");
});

test("ordinary ship weapons remain in pilot-weapons when rockets are present", () => {
  const gun = weaponRow();
  const rocket = weaponRow({
    portId: "hardpoint_gun_wing/hardpoint_class_2",
    parentPortId: "hardpoint_gun_wing",
    equippedComponentKey: "rocket-pod-1",
    equippedComponentName: "Jericho XL Rocket Pod",
    componentSubtype: "rocket",
  });
  const lookup = new Map([gun, rocket].map((row) => [row.portId, row]));

  assert.equal(offensiveGroupKey(gun, lookup), "pilot-weapons");
  assert.equal(offensiveGroupKey(rocket, lookup), "rockets");
});

test("mockup renders rocket pods in a distinct Rockets group", () => {
  const gun = weaponRow();
  const rocket = weaponRow({
    portId: "hardpoint_gun_wing/hardpoint_class_2",
    parentPortId: "hardpoint_gun_wing",
    equippedComponentKey: "rocket-pod-1",
    equippedComponentName: "Jericho XL Rocket Pod",
    componentSubtype: "Rocket",
  });

  const groups = buildMockupOffensiveDisplayGroups([gun, rocket]);

  assert.deepEqual(groups.map((group) => group.key), ["pilot-weapons", "rockets"]);
  assert.equal(groups[1]?.label, "Rockets");
  assert.deepEqual(groups[1]?.summaries[0]?.rows, [rocket]);
});

test("PDC turret weapons group separately from pilot and attack turrets", () => {
  const pdcRoot = weaponRow({
    portId: "hardpoint_pdc",
    portName: "hardpoint_pdc",
    portType: "Turret",
    portSubtype: "PDCTurret",
    parentPortId: null,
    equippedComponentKey: null,
    equippedComponentName: null,
    componentCategory: null,
  });
  const pdcWeapon = weaponRow({
    portId: "hardpoint_pdc/hardpoint_turret_weapon",
    portName: "hardpoint_turret_weapon",
    parentPortId: "hardpoint_pdc",
  });
  const lookup = new Map([pdcRoot, pdcWeapon].map((row) => [row.portId, row]));

  assert.equal(offensiveGroupKey(pdcWeapon, lookup), "point-defense");
});

test("bombs and torpedoes remain distinct ordnance groups", () => {
  const bomb = weaponRow({
    portId: "bomb_launcher/bomb_01",
    portName: "bomb_01",
    portType: "Bomb",
    portCategory: "missile",
    ruleCategory: "missile",
    componentCategory: "bomb",
    equippedComponentKey: "bomb-1",
    equippedComponentName: "Thunderball Bomb",
  });
  const torpedo = weaponRow({
    portId: "torpedo_launcher/torpedo_01",
    portName: "torpedo_01",
    portType: "Missile",
    portCategory: "missile",
    ruleCategory: "missile",
    componentCategory: "missile",
    componentSubtype: "Torpedo",
    equippedComponentKey: "torpedo-1",
    equippedComponentName: "Valkyrie V Missile",
  });
  const lookup = new Map([bomb, torpedo].map((row) => [row.portId, row]));

  assert.equal(offensiveGroupKey(bomb, lookup), "bombs");
  assert.equal(offensiveGroupKey(torpedo, lookup), "torpedoes");
});

test("pilot weapon summaries preserve real port ids for individual selection", () => {
  const row = weaponRow();
  const [summary] = summarizeGroupRows([row], "pilot-weapons");

  assert.equal(summary.key, row.portId);
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
