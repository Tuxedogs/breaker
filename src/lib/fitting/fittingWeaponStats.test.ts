import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateWeaponRowDisplay,
  resolveWeaponDps,
} from "./fittingWeaponStats.ts";

test("resolveWeaponDps computes alpha * fireRateRpm / 60", () => {
  const result = resolveWeaponDps({ alphaDamage: 43.65, fireRateRpm: 750, dps: null });
  assert.equal(result.source, "computed");
  if (result.source !== "computed") return;
  assert.equal(result.dps, 545.625);
});

test("resolveWeaponDps prefers extracted dps", () => {
  const result = resolveWeaponDps({ alphaDamage: 10, fireRateRpm: 600, dps: 120 });
  assert.deepEqual(result, { dps: 120, source: "extracted" });
});

test("resolveWeaponDps reports missing fields", () => {
  const result = resolveWeaponDps({ alphaDamage: 43.65, fireRateRpm: null, dps: null });
  assert.equal(result.source, "unavailable");
  if (result.source !== "unavailable") return;
  assert.deepEqual(result.missingFields, ["fireRateRpm"]);
});

test("aggregateWeaponRowDisplay sums identical turret guns", () => {
  const stats = { alphaDamage: 43.65, fireRateRpm: 750, dps: null, projectileSpeed: 1480 };
  const display = aggregateWeaponRowDisplay({
    quantities: [1, 1],
    sizes: [3, 3],
    names: ["CF-337 Panther Repeater", "CF-337 Panther Repeater"],
    statsList: [stats, stats],
  });
  assert.equal(display.quantity, 2);
  assert.equal(display.weaponName, "CF-337 Panther Repeater");
  assert.equal(display.dps, 1091.25);
  assert.equal(display.projectileSpeed, 1480);
});

test("aggregateWeaponRowDisplay handles mixed weapons", () => {
  const display = aggregateWeaponRowDisplay({
    quantities: [1, 1],
    sizes: [3, 3],
    names: ["Weapon A", "Weapon B"],
    statsList: [
      { alphaDamage: 10, fireRateRpm: 600, dps: null, projectileSpeed: 1000 },
      { alphaDamage: 20, fireRateRpm: 600, dps: null, projectileSpeed: 1200 },
    ],
  });
  assert.equal(display.mixedWeapons, true);
  assert.equal(display.weaponName, "Mixed weapons");
  assert.equal(display.mixedVelocity, true);
  assert.equal(display.projectileSpeed, null);
});
