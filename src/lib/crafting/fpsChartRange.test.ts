import assert from "node:assert/strict";
import test from "node:test";
import {
  getProjectileTravelDistance,
  normalizeFpsWeaponClass,
  resolveFpsChartRange,
} from "./fpsChartRange";

test("direct hard range governs the chart domain", () => {
  assert.deepEqual(
    resolveFpsChartRange({
      weaponClass: "SMG",
      hardRange: 35,
      projectileLifetimeTravel: 900,
    }),
    {
      value: 35,
      label: "Hard Range",
      source: "hard-range",
      weaponClass: "smg",
    },
  );
});

test("class presentation windows keep charts within realistic review distances", () => {
  assert.equal(resolveFpsChartRange({ weaponClass: "shotgun" })?.value, 50);
  assert.equal(resolveFpsChartRange({ weaponClass: "submachine gun" })?.value, 100);
  assert.equal(resolveFpsChartRange({ weaponClass: "pistol" })?.value, 100);
  assert.equal(resolveFpsChartRange({ weaponClass: "assault rifle" })?.value, 250);
  assert.equal(resolveFpsChartRange({ compatibleWeaponClass: "LMG" })?.value, 250);
  assert.equal(resolveFpsChartRange({ weaponClass: "sniper rifle" })?.value, 500);
});

test("projectile lifetime travel is context only and never becomes a chart domain", () => {
  const stats = {
    weaponClass: "smg",
    projectileLifetimeTravel: 1200,
    calculatedRange: 1200,
  };

  assert.equal(resolveFpsChartRange(stats)?.value, 100);
  assert.equal(getProjectileTravelDistance(stats), 1200);
  assert.equal(resolveFpsChartRange({ projectileLifetimeTravel: 1200 }), null);
});

test("weapon class aliases normalize without relabeling unknown classes", () => {
  assert.equal(normalizeFpsWeaponClass("Marksman Rifle"), "sniper");
  assert.equal(normalizeFpsWeaponClass("Laser Carbine"), "lasercarbine");
});
