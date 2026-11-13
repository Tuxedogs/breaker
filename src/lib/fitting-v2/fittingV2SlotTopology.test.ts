import assert from "node:assert/strict";
import test from "node:test";
import { buildFittingV2SlotTopology } from "./fittingV2SlotTopology";
import type { PortBreakdownRow } from "../fitting/fittingPortGrouping";

function row(input: Partial<PortBreakdownRow>): PortBreakdownRow {
  return { shipKey: "perseus", portId: "port", portName: null, portType: null, portSubtype: null, portCategory: null, ruleCategory: null, parentPortId: null, childPortIds: [], equippedComponentKey: null, equippedComponentName: null, componentCategory: null, componentManufacturer: null, componentSize: null, portExactSize: null, portMinSize: null, portMaxSize: null, componentSubtype: null, compatibilityStatus: "known", editable: true, bespoke: false, locked: false, confidence: "high", ...input };
}

test("topology retains identical ordinary components as separate physical slots", () => {
  const topology = buildFittingV2SlotTopology([
    row({ portId: "cooler_1", portName: "Cooler 1", portType: "Cooler", equippedComponentKey: "mercury", equippedComponentName: "Mercury", componentSize: 3 }),
    row({ portId: "cooler_2", portName: "Cooler 2", portType: "Cooler", equippedComponentKey: "mercury", equippedComponentName: "Mercury", componentSize: 3 }),
  ]);
  const components = topology.tabs.find((tab) => tab.tab === "components");
  assert.equal(components?.tab, "components");
  assert.equal(components?.sections[0]?.slots.length, 2);
  assert.deepEqual(components?.sections[0]?.slots.map((slot) => slot.target.portId), ["cooler_1", "cooler_2"]);
});

test("topology preserves separate turret leaf slots and excludes PDC from weapons", () => {
  const topology = buildFittingV2SlotTopology([
    row({ portId: "turret_top", portName: "Manned Turret Top", portType: "TurretBase", portSubtype: "MannedTurret", childPortIds: ["turret_top/gimbal"] }),
    row({ portId: "turret_top/gimbal", portName: "Gimbal Left", portType: "Turret", portSubtype: "GunTurret", parentPortId: "turret_top", childPortIds: ["turret_top/gimbal/gun_1", "turret_top/gimbal/gun_2"] }),
    row({ portId: "turret_top/gimbal/gun_1", portName: "Weapon 1", portType: "WeaponGun", parentPortId: "turret_top/gimbal", equippedComponentKey: "gun", equippedComponentName: "Mantis" }),
    row({ portId: "turret_top/gimbal/gun_2", portName: "Weapon 2", portType: "WeaponGun", parentPortId: "turret_top/gimbal", equippedComponentKey: "gun", equippedComponentName: "Mantis" }),
    row({ portId: "pdc", portName: "PDC Top", portType: "Turret", portSubtype: "PDCTurret", childPortIds: ["pdc/gun"] }),
    row({ portId: "pdc/gun", portName: "PDC Gun", portType: "WeaponGun", parentPortId: "pdc", editable: false }),
  ]);
  const weapons = topology.tabs.find((tab) => tab.tab === "weapons");
  assert.equal(weapons?.tab, "weapons");
  assert.equal(weapons?.assemblies[0]?.slots.length, 2);
  assert.equal(weapons?.assemblies[0]?.slots[0]?.context[0], "Gimbal Left");
  const special = topology.tabs.find((tab) => tab.tab === "special");
  assert.equal(special?.tab, "special");
  assert.equal(special?.assemblies[0]?.root.target.replacement, "informational");
  assert.equal(special?.assemblies[0]?.children[0]?.target.replacement, "informational");
});

test("topology returns one rack payload target and retains mixed payload truth", () => {
  const topology = buildFittingV2SlotTopology([
    row({ portId: "rack_left", portName: "Torpedo Rack Left", portType: "MissileLauncher", portSubtype: "MissileRack", childPortIds: ["rack_left/missile_1", "rack_left/missile_2"] }),
    row({ portId: "rack_left/missile_1", portName: "Missile 1", portType: "Missile", parentPortId: "rack_left", equippedComponentKey: "reaper", equippedComponentName: "Reaper V", componentSize: 5 }),
    row({ portId: "rack_left/missile_2", portName: "Missile 2", portType: "Missile", parentPortId: "rack_left", equippedComponentKey: "reaper", equippedComponentName: "Reaper V", componentSize: 5 }),
  ]);
  const missiles = topology.tabs.find((tab) => tab.tab === "missiles");
  assert.equal(missiles?.tab, "missiles");
  assert.equal(missiles?.racks.length, 1);
  assert.equal(missiles?.racks[0]?.payloadCount, 2);
  assert.deepEqual(missiles?.racks[0]?.payloadPortIds, ["rack_left/missile_1", "rack_left/missile_2"]);
  assert.equal(missiles?.racks[0]?.payload.target.replacement, "rack-payload");
  assert.equal(missiles?.racks[0]?.payload.target.payloadCount, 2);
});

test("special topology remains visible for an empty or locked slot", () => {
  const topology = buildFittingV2SlotTopology([row({ portId: "emp", portName: "EMP", portType: "EMP", editable: false, locked: true })]);
  const special = topology.tabs.find((tab) => tab.tab === "special");
  assert.equal(special?.tab, "special");
  assert.equal(special?.assemblies[0]?.root.target.installedComponentId, null);
  assert.equal(special?.assemblies[0]?.root.target.replacement, "informational");
});
