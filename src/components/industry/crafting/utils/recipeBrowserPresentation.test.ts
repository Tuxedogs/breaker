import assert from "node:assert/strict";
import test from "node:test";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import {
  formatDuration,
  getRecipeBrowserFamily,
} from "./recipeBrowserPresentation";

function record(overrides: Partial<ComponentCardIndexRecord>): ComponentCardIndexRecord {
  return {
    id: "test",
    name: "Test component",
    kind: "vehicle",
    category: "vehicle",
    type: "weaponGun",
    typeLabel: "Vehicle Weapon",
    size: 1,
    grade: "A",
    class: "military",
    craftTimeSeconds: 90,
    searchText: "",
    facets: { materials: [], materialNames: [] },
    sort: { name: "test", type: "weaponGun" },
    card: { materialsPreview: [], badges: [], modifierLabels: [] },
    stats: {
      generic: {
        mass: 0,
        health: 0,
        emSignature: null,
        irSignature: null,
        distortionMaximum: null,
      },
      cooler: null,
      powerPlant: null,
      quantumDrive: null,
      shield: null,
      shipWeapon: { alphaDamageTotal: 0, fireRateRpm: 0 },
      radar: null,
      tractorBeam: null,
      fpsWeapon: null,
      fpsArmor: null,
      fpsAmmo: null,
    },
    source: { files: [], fields: [], warnings: [] },
    ...overrides,
  };
}

test("selects a family-specific table schema", () => {
  assert.equal(getRecipeBrowserFamily(record({ type: "weaponGun" })).key, "vehicleWeapon");
  assert.equal(getRecipeBrowserFamily(record({ kind: "fps", type: "armor" })).key, "fpsArmor");
  assert.equal(getRecipeBrowserFamily(record({ kind: "fps", type: "utility" })).key, "fpsOther");
});

test("preserves valid zero values in table cells", () => {
  const family = getRecipeBrowserFamily(record({ type: "weaponGun" }));
  assert.equal(family.columns.find((column) => column.key === "alpha")?.value(record({})), "0");
});

test("ship weapons expose penetration and shared-resolver DPS columns", () => {
  const weapon = record({
    stats: {
      ...record({}).stats,
      shipWeapon: {
        alphaDamageTotal: 72,
        fireRateRpm: 250,
        penetration: 0.5,
      },
    },
  });
  const family = getRecipeBrowserFamily(weapon);
  assert.equal(family.columns.find((column) => column.key === "dps")?.value(weapon), "300");
  assert.equal(family.columns.find((column) => column.key === "penetration")?.value(weapon), "0.5");
});

test("radar exposes independent power-pip and assist-range columns", () => {
  const radar = record({
    type: "radar",
    stats: {
      ...record({}).stats,
      radar: {
        powerUsageMin: 1,
        powerUsageMax: 4,
        aimAssistRangeMin: 780,
        aimAssistRangeMax: 1173,
      },
    },
  });
  const family = getRecipeBrowserFamily(radar);
  assert.equal(family.key, "radar");
  assert.deepEqual(
    family.columns.map((column) => column.key),
    ["size", "powerPipsMin", "powerPipsMax", "assistMin", "assistMax", "gradeClass"],
  );
});

test("formats craft time compactly", () => {
  assert.equal(formatDuration(10), "10s");
  assert.equal(formatDuration(90), "1m 30s");
});
