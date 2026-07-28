import assert from "node:assert/strict";
import test from "node:test";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import {
  filterRecipeBrowserRecords,
  matchesRecipeBrowserCategory,
  matchesRecipeBrowserAppliedFilters,
  pickPreferredRecipeBrowserSearchRecord,
} from "./recipeBrowserFilters";

function record(kind: "vehicle" | "fps", type: string): ComponentCardIndexRecord {
  return {
    id: `${kind}:${type}`,
    name: `${kind} ${type}`,
    kind,
    category: kind,
    type,
    typeLabel: type,
    size: kind === "vehicle" ? 1 : null,
    grade: kind === "vehicle" ? "A" : null,
    class: kind === "vehicle" ? "military" : null,
    craftTimeSeconds: 10,
    searchText: `${kind} ${type}`,
    facets: { materials: ["material"], materialNames: ["material"] },
    sort: { name: type, type },
    card: { materialsPreview: [], badges: [], modifierLabels: [] },
    stats: {
      generic: {
        mass: null,
        health: null,
        emSignature: null,
        irSignature: null,
        distortionMaximum: null,
      },
      cooler: null,
      powerPlant: null,
      quantumDrive: null,
      shield: null,
      shipWeapon: null,
      radar: null,
      tractorBeam: null,
      fpsWeapon: null,
      fpsArmor: null,
      fpsAmmo: null,
    },
    source: { files: [], fields: [], warnings: [] },
  };
}

test("category choices form one OR family across vehicle and FPS", () => {
  const vehicle = new Set(["shield"]);
  const fps = new Set(["weapons"]);
  assert.equal(matchesRecipeBrowserCategory(record("vehicle", "shield"), vehicle, fps), true);
  assert.equal(matchesRecipeBrowserCategory(record("fps", "weapons"), vehicle, fps), true);
  assert.equal(matchesRecipeBrowserCategory(record("vehicle", "cooler"), vehicle, fps), false);
});

test("approved grouped category mappings do not invent utility data", () => {
  assert.equal(matchesRecipeBrowserCategory(
    record("vehicle", "weaponMining"),
    new Set(["__mining__"]),
    new Set(),
  ), true);
  assert.equal(matchesRecipeBrowserCategory(
    record("vehicle", "salvageModifier"),
    new Set(["__salvage__"]),
    new Set(),
  ), true);
  assert.equal(matchesRecipeBrowserCategory(
    record("fps", "ammo"),
    new Set(),
    new Set(["__other__"]),
  ), true);
  assert.equal(matchesRecipeBrowserCategory(
    record("fps", "ammo"),
    new Set(),
    new Set(["__utility__"]),
  ), false);
});

test("different filter families combine with AND", () => {
  const records = [
    record("vehicle", "shield"),
    { ...record("vehicle", "shield"), id: "wrong-size", size: 2 },
    record("fps", "weapons"),
  ];
  const params = new URLSearchParams("v=shield&sz=1&mt=material");
  assert.deepEqual(filterRecipeBrowserRecords(records, params).map((item) => item.id), ["vehicle:shield"]);
});

test("manual text search overrides filters while retaining filter-match truth", () => {
  const shield = { ...record("vehicle", "shield"), searchText: "paladin shield" };
  const weapon = { ...record("fps", "weapons"), searchText: "paladin fps weapon" };
  const params = new URLSearchParams("v=shield&sz=1&search=paladin");

  assert.deepEqual(
    filterRecipeBrowserRecords([shield, weapon], params).map((item) => item.id).sort(),
    ["fps:weapons", "vehicle:shield"],
  );
  assert.equal(matchesRecipeBrowserAppliedFilters(shield, params), true);
  assert.equal(matchesRecipeBrowserAppliedFilters(weapon, params), false);
});

test("an FPS weapon is the preferred search target over its magazine", () => {
  const weapon = {
    ...record("fps", "weapons"),
    id: "weapon",
    name: "C54 SMG",
    searchText: "c54 smg",
  };
  const magazine = {
    ...record("fps", "ammo"),
    id: "magazine",
    name: "C54 SMG Magazine",
    searchText: "c54 smg magazine",
  };

  assert.equal(
    pickPreferredRecipeBrowserSearchRecord([magazine, weapon], "C54")?.id,
    "weapon",
  );
});
