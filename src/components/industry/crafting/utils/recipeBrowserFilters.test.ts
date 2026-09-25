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

test("an empty query returns the complete mixed inventory without an implicit category", () => {
  const records = [
    record("vehicle", "weaponGun"),
    record("vehicle", "shield"),
    record("fps", "weapons"),
    record("fps", "armor"),
  ];

  assert.deepEqual(
    filterRecipeBrowserRecords(records, new URLSearchParams()).map((item) => item.id).sort(),
    records.map((item) => item.id).sort(),
  );
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

test("text search intersects applied filters", () => {
  const shield = { ...record("vehicle", "shield"), searchText: "paladin shield" };
  const weapon = { ...record("fps", "weapons"), searchText: "paladin fps weapon" };
  const params = new URLSearchParams("v=shield&sz=1&search=paladin");

  assert.deepEqual(
    filterRecipeBrowserRecords([shield, weapon], params).map((item) => item.id).sort(),
    ["vehicle:shield"],
  );
  assert.equal(matchesRecipeBrowserAppliedFilters(shield, params), true);
  assert.equal(matchesRecipeBrowserAppliedFilters(weapon, params), false);
});

test("multiple values within a filter group use OR while groups still use AND", () => {
  const shield = { ...record("vehicle", "shield"), id: "shield-a", size: 1 };
  const cooler = { ...record("vehicle", "cooler"), id: "cooler-a", size: 1 };
  const weapon = { ...record("vehicle", "weaponGun"), id: "weapon-a", size: 1 };
  const wrongSize = { ...record("vehicle", "shield"), id: "shield-b", size: 2 };
  const params = new URLSearchParams("v=shield,cooler&sz=1");

  assert.deepEqual(
    filterRecipeBrowserRecords([shield, cooler, weapon, wrongSize], params).map((item) => item.id).sort(),
    ["cooler-a", "shield-a"],
  );
});

test("unknown URL filter values are ignored instead of constraining results", () => {
  const records = [record("vehicle", "weaponGun"), record("fps", "weapons")];
  const params = new URLSearchParams(
    "v=not-a-category&f=also-invalid&sz=99&gr=Z&cl=pirate&mt=unknown-material",
  );

  assert.deepEqual(
    filterRecipeBrowserRecords(records, params).map((item) => item.id).sort(),
    records.map((item) => item.id).sort(),
  );
});

test("valid and invalid URL values canonicalize to the valid explicit selection", () => {
  const shield = record("vehicle", "shield");
  const weapon = record("vehicle", "weaponGun");
  const params = new URLSearchParams("v=ship-weapons,invalid&sz=1,99");

  assert.deepEqual(
    filterRecipeBrowserRecords([shield, weapon], params).map((item) => item.id),
    ["vehicle:weaponGun"],
  );
});

test("Vehicle Weapons uses the canonical vehicle weapon type and excludes mining lasers", () => {
  const vehicleWeapon = {
    ...record("vehicle", "WeaponGun"),
    id: "ship-weapon",
    searchText: "greatsword cannon",
  };
  const miningLaser = {
    ...record("vehicle", "weaponMining"),
    id: "mining-laser",
    searchText: "greatsword mining laser",
  };
  const params = new URLSearchParams("v=vehicle-weapons&search=greatsword");

  assert.deepEqual(
    filterRecipeBrowserRecords([vehicleWeapon, miningLaser], params).map((item) => item.id),
    ["ship-weapon"],
  );
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
