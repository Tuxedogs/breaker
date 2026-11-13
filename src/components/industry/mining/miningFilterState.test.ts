import assert from "node:assert/strict";
import test from "node:test";

import { deriveMiningFilterState, projectMiningRequestMaterials, restoreMiningSystemSelection, type MiningPresenceIndex } from "./miningFilterState.js";

const presenceOf = (spec: Record<string, Record<string, string[]>>): MiningPresenceIndex =>
  new Map(Object.entries(spec).map(([system, locations]) => [
    system,
    new Map(Object.entries(locations).map(([location, materials]) => [location, new Set(materials)])),
  ]));

const presence = presenceOf({
  Stanton: { aberdeen: ["riccite", "copper", "iron"], daymar: ["copper", "tin"], yela: ["agricium"] },
  Pyro: { bloom: ["riccite", "gold"], monox: ["copper", "gold"] },
  Nyx: { glaciem: ["stileron"] },
});
const materialKeys = ["riccite", "copper", "iron", "tin", "agricium", "gold", "stileron"];
const derive = (systems: string[], materials: string[]) => deriveMiningFilterState({
  presence,
  selectedSystems: new Set(systems),
  selectedMaterials: new Set(materials),
  materialKeys,
  systemOrder: ["Stanton", "Pyro", "Nyx"],
});
const availability = (state: ReturnType<typeof derive>, key: string) => state.chipStateByMaterial.get(key)?.availability;

test("muting keeps only materials at locations containing all selected materials", () => {
  const state = derive([], ["riccite", "copper"]);
  assert.deepEqual([...(state.coOccurringMaterials ?? [])].sort(), ["copper", "iron", "riccite"]);
  assert.equal(availability(state, "iron"), "normal");
  assert.equal(availability(state, "gold"), "muted");
  assert.equal(availability(state, "tin"), "muted");
  assert.equal(state.chipStateByMaterial.get("riccite")?.selected, true);
});

test("an unavailable selected material does not collapse the intersection", () => {
  const state = derive(["Pyro"], ["riccite", "iron"]);
  assert.equal(availability(state, "iron"), "selectedUnavailable");
  assert.equal(availability(state, "gold"), "normal");
  assert.equal(availability(state, "copper"), "muted");
});

test("no selected systems means all systems", () => {
  const state = derive([], []);
  assert.deepEqual(state.activeSystems.size, 0);
  assert.deepEqual([...(state.availableMaterials ?? [])].sort(), [...materialKeys].sort());
  for (const key of materialKeys) assert.equal(availability(state, key), "normal");
});

test("material selection never changes the systems shown", () => {
  const base = derive(["Stanton"], []).systemsShown;
  assert.deepEqual(base, ["Stanton", "Pyro", "Nyx"]);
  assert.deepEqual(derive(["Stanton"], ["stileron"]).systemsShown, base);
  assert.deepEqual(derive([], ["riccite", "gold"]).systemsShown, base);
});

test("systems outside the selection disable materials found only there", () => {
  const state = derive(["Stanton", "Pyro"], []);
  assert.equal(availability(state, "stileron"), "disabled");
  assert.equal(availability(state, "gold"), "normal");
});

test("deselecting a system flags its exclusive selected material and excludes it from the request", () => {
  const selected = new Set(["agricium", "riccite"]);
  const before = derive(["Stanton", "Pyro"], [...selected]);
  assert.deepEqual([...before.requestMaterials], ["agricium", "riccite"]);
  const after = derive(["Pyro"], [...selected]);
  assert.equal(availability(after, "agricium"), "selectedUnavailable");
  assert.equal(after.chipStateByMaterial.get("agricium")?.selected, true);
  assert.deepEqual([...after.requestMaterials], ["riccite"]);
  assert.equal(selected.has("agricium"), true);
});

test("unknown presence leaves every chip normal and requests every selection", () => {
  const state = deriveMiningFilterState({ presence: new Map(), selectedSystems: new Set(["Pyro"]), selectedMaterials: new Set(["riccite"]), materialKeys });
  assert.equal(state.availableMaterials, null);
  assert.deepEqual([...state.requestMaterials], ["riccite"]);
  for (const key of materialKeys) assert.equal(availability(state, key), "normal");
});

test("persisted system restore drops invalid names and invalid values", () => {
  const known = ["Stanton", "Pyro", "Nyx"];
  assert.deepEqual([...restoreMiningSystemSelection(["Pyro", "Hurston", 4, null, "Nyx"], known)], ["Pyro", "Nyx"]);
  assert.deepEqual([...restoreMiningSystemSelection("Pyro", known)], []);
  assert.deepEqual([...restoreMiningSystemSelection(undefined, known)], []);
});

test("Explore requests queue-overlapping selections once with Explore demand", () => {
  const sidebar = ["gold", "copper"].map((key) => ({ materialId: key, materialKey: key, materialName: key, requiredQuantity: 1, usedBy: [], slots: [] }));
  const queue = [{ ...sidebar[0], requiredQuantity: 12, selectedQuality: 924 }];
  const projected = projectMiningRequestMaterials(sidebar, queue, false, null);
  assert.deepEqual(projected.recommenderRequiredMaterials, sidebar);
  assert.deepEqual(projected.sidebarOnlyMaterials, sidebar);
  assert.equal(new Set(projected.recommenderRequiredMaterials.map((m) => m.materialKey)).size, 2);
});

test("Queue keeps its actual quantity and quality without duplicate sidebar demand", () => {
  const sidebar = ["gold", "copper", "iron"].map((key) => ({ materialId: key, materialKey: key, materialName: key, requiredQuantity: 1, usedBy: [], slots: [] }));
  const queue = [{ ...sidebar[0], requiredQuantity: 12, selectedQuality: 924 }];
  const projected = projectMiningRequestMaterials(sidebar, queue, true, new Set(["gold", "copper"]));
  assert.deepEqual(projected.recommenderRequiredMaterials, [queue[0], sidebar[1]]);
  assert.equal(projected.recommenderRequiredMaterials[0], queue[0]);
  assert.deepEqual(projected.sidebarOnlyMaterials, [sidebar[1]]);
  assert.equal(sidebar.length, 3);
});

test("system-unavailable selections remain selected but never enter Explore requests", () => {
  const sidebar = ["gold", "copper"].map((key) => ({ materialId: key, materialKey: key, materialName: key, requiredQuantity: 1, usedBy: [], slots: [] }));
  const projected = projectMiningRequestMaterials(sidebar, [], false, new Set(["copper"]));
  assert.deepEqual(projected.recommenderRequiredMaterials, [sidebar[1]]);
  assert.deepEqual(sidebar.map((m) => m.materialKey), ["gold", "copper"]);
});
