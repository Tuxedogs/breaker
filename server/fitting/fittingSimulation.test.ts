import assert from "node:assert/strict";
import test from "node:test";
import {
  FITTING_SIMULATION_MODEL_VERSION,
  type FittingSimulationAllocation,
  type FittingSimulationInput,
  type NormalizedFittingSimulationComponent,
  simulateFitting as simulateFittingModel,
} from "./fittingSimulation.ts";

function simulateFitting(input: FittingSimulationInput) {
  const fittedWeaponDemand = input.components
    .filter((component) => component.weapon != null)
    .reduce((total, component) => total + (component.nominalPowerDemandSegments ?? 0), 0);
  return simulateFittingModel({ weaponPowerPoolSegments: fittedWeaponDemand, ...input });
}

function gladiusComponents(): NormalizedFittingSimulationComponent[] {
  return [
    {
      id: "js-300",
      componentType: "power_plant",
      powerCapacitySegments: 17,
    },
    {
      id: "snowblind-1",
      componentType: "cooler",
      powerCategory: "cooler1",
      nominalPowerDemandSegments: 1,
      nominalPowerDemandUnitType: "PowerSegment",
      coolingCapacity: 24,
    },
    {
      id: "snowblind-2",
      componentType: "cooler",
      powerCategory: "cooler2",
      nominalPowerDemandSegments: 1,
      nominalPowerDemandUnitType: "PowerSegment",
      coolingCapacity: 24,
    },
    ...Array.from({ length: 3 }, (_, index) => ({
      id: `quarreler-${index + 1}`,
      componentType: "ship_weapon",
      powerCategory: "weapons" as const,
      nominalPowerDemandSegments: 1.73,
      nominalPowerDemandUnitType: "StandardResource",
      weaponMountTopology: "pilot" as const,
      weapon: {
        alphaDamage: 218.7,
        fireRateRpm: 150,
        ammoCostPerShot: 1,
        maxAmmoLoad: 25,
        maxRegenPerSecond: 3,
        regenCooldownSeconds: 1.76,
        heatPerShot: 0,
      },
    })),
  ];
}

function gladiusAllocation(weapons: number): FittingSimulationAllocation {
  return { weapons, shields: 0, cooler1: 1, cooler2: 1 };
}

test("reports the versioned Gladius power and cooling aggregates", () => {
  const result = simulateFitting({
    components: gladiusComponents(),
    powerAllocation: gladiusAllocation(3),
  });

  assert.equal(result.modelVersion, FITTING_SIMULATION_MODEL_VERSION);
  assert.equal(result.power.capacitySegments.value, 17);
  assert.equal(result.power.allocatedSegments.value, 5);
  assert.equal(result.power.marginSegments.value, 12);
  assert.equal(result.cooling.capacity.value, 48);
  assert.equal(result.cooling.demand.value, 5);
  assert.equal(Number(result.cooling.utilizationPercent.value?.toFixed(1)), 10.4);
  assert.equal(result.power.capacitySegments.provenance, "derived");
  assert.ok(result.provenance.directInputs.some((entry) => entry.componentId === "js-300"));
  assert.ok(result.assumptions.some((entry) => entry.includes("Foundry provides no conversion curve")));
});

test("matches the observed SnowBlind cooling utilization sweep", () => {
  const observed = [
    { weapons: 0, utilization: 4.2 },
    { weapons: 1, utilization: 6.3 },
    { weapons: 2, utilization: 8.3 },
    { weapons: 3, utilization: 10.4 },
  ];

  for (const sample of observed) {
    const result = simulateFitting({
      components: gladiusComponents(),
      powerAllocation: gladiusAllocation(sample.weapons),
    });
    assert.equal(
      Number(result.cooling.utilizationPercent.value?.toFixed(1)),
      sample.utilization,
    );
  }
});

test("fires full Quarreler magazines and waits for complete refills over 60 seconds", () => {
  const result = simulateFitting({
    components: gladiusComponents(),
    powerAllocation: gladiusAllocation(3 * 1.73),
    durationSeconds: 60,
  });

  assert.equal(result.weapons.length, 3);
  for (const weapon of result.weapons) {
    assert.equal(weapon.ammunitionModel, "energy");
    assert.equal(weapon.allocationRatio.value, 1);
    assert.equal(weapon.effectiveAmmo.value, 25);
    assert.equal(weapon.effectiveRegenPerSecond.value, 3);
    assert.equal(weapon.shotsFired.value, 75);
    assert.equal(weapon.damage.value, 16_402.5);
    assert.equal(weapon.dps.value, 273.375);
    assert.equal(weapon.completeMagazinesFired, 3);
    assert.equal(weapon.magazineStartTimesSeconds.length, 3);
  }
  assert.equal(result.weaponsSummary.simulatedWeaponCount.value, 3);
  assert.equal(result.weaponsSummary.totalDamage.value, 49_207.5);
  assert.equal(result.weaponsSummary.dps.value, 820.125);
});

test("rounds energy capacity at partial weapon allocation", () => {
  const result = simulateFitting({
    components: gladiusComponents(),
    powerAllocation: gladiusAllocation(1),
  });

  assert.equal(result.weapons[0]?.effectiveAmmo.value, 5);
  assert.ok(Math.abs((result.weapons[0]?.effectiveRegenPerSecond.value ?? 0) - 3 / 5.19) < 1e-12);
});

test("caps Gladius weapon allocation at the extracted four-segment weapon pool", () => {
  const result = simulateFitting({
    components: gladiusComponents(),
    powerAllocation: gladiusAllocation(3 * 1.73),
    weaponPowerPoolSegments: 4,
    weaponPowerPoolSourcePath: "SItemPortContainerComponentParams/resourceNetworkPowerPools/itemPools/FixedPowerPool[@itemType='WeaponGun']/@poolSize",
  });

  assert.equal(result.power.weaponPoolCapacitySegments.value, 4);
  assert.equal(result.power.allocatedByCategory.weapons, 4);
  assert.ok(Math.abs((result.weapons[0]?.allocationRatio.value ?? 0) - 4 / 5.19) < 1e-12);
  assert.equal(result.weapons[0]?.effectiveAmmo.value, 19);
  assert.ok(result.weapons[0]?.allocationRatio.sources.some(
    (entry) => entry.path.includes("FixedPowerPool") && entry.value === 4,
  ));
});

test("does not derive weapon or aggregate resource results without a weapon power pool", () => {
  const result = simulateFittingModel({
    components: gladiusComponents(),
    powerAllocation: gladiusAllocation(3),
  });

  assert.equal(result.power.weaponPoolCapacitySegments.value, null);
  assert.equal(result.power.allocatedSegments.value, null);
  assert.equal(result.power.marginSegments.value, null);
  assert.equal(result.cooling.demand.value, null);
  assert.equal(result.weapons[0]?.allocationRatio.value, null);
  assert.equal(result.weapons[0]?.dps.value, null);
  assert.ok(result.missingInputs.some(
    (entry) => entry.path === "ship.resourceNetworkPowerPools.fixed[itemType=WeaponGun].poolSize",
  ));
});

test("ballistic weapons consume their finite reserve without refilling", () => {
  const result = simulateFitting({
    components: [
      { id: "plant", componentType: "power_plant", powerCapacitySegments: 10 },
      {
        id: "ballistic",
        componentType: "ship_weapon",
        powerCategory: "weapons",
        nominalPowerDemandSegments: 1,
        weapon: { alphaDamage: 10, fireRateRpm: 120, ammoCapacity: 30, ammoCostPerShot: 1, heatPerShot: 0 },
      },
    ],
    powerAllocation: { weapons: 1 },
    durationSeconds: 60,
  });

  assert.equal(result.weapons[0]?.ammunitionModel, "ballistic");
  assert.equal(result.weapons[0]?.shotsFired.value, 30);
  assert.equal(result.weapons[0]?.damage.value, 300);
  assert.equal(result.weapons[0]?.dps.value, 5);
  assert.equal(result.weapons[0]?.magazineStartTimesSeconds.length, 1);
});

test("does not fire a ballistic weapon with zero allocated weapon power", () => {
  const result = simulateFitting({
    components: [
      { id: "plant", componentType: "power_plant", powerCapacitySegments: 10 },
      {
        id: "ballistic",
        componentType: "ship_weapon",
        powerCategory: "weapons",
        nominalPowerDemandSegments: 1,
        weapon: { alphaDamage: 10, fireRateRpm: 120, ammoCapacity: 30, ammoCostPerShot: 1, heatPerShot: 0 },
      },
    ],
    powerAllocation: { weapons: 0 },
    durationSeconds: 60,
  });

  assert.equal(result.weapons[0]?.shotsFired.value, 0);
  assert.equal(result.weapons[0]?.damage.value, 0);
  assert.ok(result.weapons[0]?.assumptions.includes(
    "Zero allocated weapon power prevents ballistic firing.",
  ));
});

test("converts energy ammunition resource units to shots using ammo cost", () => {
  const result = simulateFitting({
    components: [
      { id: "plant", componentType: "power_plant", powerCapacitySegments: 10 },
      {
        id: "energy",
        componentType: "ship_weapon",
        powerCategory: "weapons",
        nominalPowerDemandSegments: 1,
        weaponMountTopology: "pilot",
        weapon: {
          alphaDamage: 10,
          fireRateRpm: 60,
          ammoCostPerShot: 2,
          maxAmmoLoad: 10,
          maxRegenPerSecond: 2,
          regenCooldownSeconds: 0,
          heatPerShot: 0,
        },
      },
    ],
    powerAllocation: { weapons: 1 },
    durationSeconds: 20,
  });

  assert.equal(result.weapons[0]?.effectiveAmmo.value, 10);
  assert.equal(result.weapons[0]?.shotsFired.value, 10);
  assert.equal(result.weapons[0]?.dps.value, 5);
});

test("converts ballistic reserve resource units to shots using ammo cost", () => {
  const result = simulateFitting({
    components: [
      { id: "plant", componentType: "power_plant", powerCapacitySegments: 10 },
      {
        id: "ballistic",
        componentType: "ship_weapon",
        powerCategory: "weapons",
        nominalPowerDemandSegments: 1,
        weapon: {
          alphaDamage: 10,
          fireRateRpm: 600,
          ammoCostPerShot: 2,
          ammoCapacity: 9,
          heatPerShot: 0,
        },
      },
    ],
    powerAllocation: { weapons: 1 },
    durationSeconds: 60,
  });

  assert.equal(result.weapons[0]?.shotsFired.value, 4);
  assert.equal(result.weapons[0]?.damage.value, 40);
});

test("does not invent an ammunition cost when the source value is unavailable", () => {
  const components = gladiusComponents();
  const firstWeapon = components.find((component) => component.weapon != null);
  assert.ok(firstWeapon?.weapon);
  firstWeapon.weapon.ammoCostPerShot = null;

  const result = simulateFitting({
    components,
    powerAllocation: gladiusAllocation(3 * 1.73),
    durationSeconds: 60,
  });

  assert.equal(result.weapons[0]?.shotsFired.value, null);
  assert.equal(result.weapons[0]?.dps.value, null);
  assert.ok(result.weapons[0]?.missingInputs.some(
    (entry) => entry.path === "weapon.ammoCostPerShot",
  ));
  assert.equal(result.weaponsSummary.dps.value, null);
});

test("counts shots in a half-open time window", () => {
  const result = simulateFitting({
    components: [
      { id: "plant", componentType: "power_plant", powerCapacitySegments: 10 },
      {
        id: "ballistic",
        componentType: "ship_weapon",
        powerCategory: "weapons",
        nominalPowerDemandSegments: 1,
        weapon: { alphaDamage: 10, fireRateRpm: 60, ammoCapacity: 10, ammoCostPerShot: 1, heatPerShot: 0 },
      },
    ],
    powerAllocation: { weapons: 1 },
    durationSeconds: 2,
  });

  // Shots occur at t=0 and t=1; the potential shot at t=2 is excluded.
  assert.equal(result.weapons[0]?.shotsFired.value, 2);
});

test("records that zero heat per shot cannot interrupt firing", () => {
  const components = gladiusComponents();
  for (const component of components) {
    if (component.weapon) component.weapon.heatPerShot = 0;
  }
  const result = simulateFitting({
    components,
    powerAllocation: gladiusAllocation(3 * 1.73),
  });

  assert.ok(result.weapons.every((weapon) => weapon.assumptions.includes(
    "heatPerShot is zero; no heat or overheat interruption applies.",
  )));
  assert.ok(result.weapons.every((weapon) => !weapon.missingInputs.some(
    (entry) => entry.path.startsWith("weapon.") && entry.path !== "weapon.heatPerShot",
  )));
});

test("does not publish DPS when weapon heat timing is unavailable", () => {
  const components = gladiusComponents();
  const firstWeapon = components.find((component) => component.weapon != null);
  assert.ok(firstWeapon?.weapon);
  firstWeapon.weapon.heatPerShot = null;

  const result = simulateFitting({
    components,
    powerAllocation: gladiusAllocation(3 * 1.73),
  });

  assert.equal(result.weapons[0]?.dps.value, null);
  assert.equal(result.weaponsSummary.dps.value, null);
  assert.ok(result.weapons[0]?.missingInputs.some(
    (entry) => entry.path === "weapon.heatPerShot",
  ));
});

test("reports precise missing thermal dependencies when heat is positive", () => {
  const components = gladiusComponents();
  const firstWeapon = components.find((component) => component.weapon)?.weapon;
  assert.ok(firstWeapon);
  firstWeapon.heatPerShot = 5;
  firstWeapon.minimumTemperature = 0;
  firstWeapon.overheatTemperature = 100;

  const result = simulateFitting({
    components,
    powerAllocation: gladiusAllocation(3 * 1.73),
  });
  const weapon = result.weapons[0];
  assert.ok(weapon);
  assert.ok(weapon.missingInputs.some((entry) => entry.path === "weapon.coolingPerSecond"));
  assert.ok(weapon.assumptions.some((entry) => entry.includes("weapon.coolingPerSecond")));
});

test("applies source-backed overheat interruptions and accepts negative minimum temperatures", () => {
  const result = simulateFitting({
    components: [
      { id: "plant", componentType: "power_plant", powerCapacitySegments: 10 },
      {
        id: "thermal-ballistic",
        componentType: "ship_weapon",
        powerCategory: "weapons",
        nominalPowerDemandSegments: 1,
        weapon: {
          alphaDamage: 10,
          fireRateRpm: 60,
          ammoCapacity: 100,
          ammoCostPerShot: 1,
          heatPerShot: 5,
          minimumTemperature: -10,
          overheatTemperature: 10,
          coolingPerSecond: 0,
          coolingDelaySeconds: 0,
          overheatRecoverySeconds: 2,
          temperatureAfterOverheatRecovery: 2,
        },
      },
    ],
    powerAllocation: { weapons: 1 },
    durationSeconds: 12,
  });

  const weapon = result.weapons[0];
  assert.ok(weapon);
  assert.equal(weapon.maxShotsBeforeOverheat.value, 4);
  assert.equal(weapon.overheatInterruptions.value, 2);
  assert.equal(weapon.overheatTimeSeconds.value, 4);
  assert.equal(weapon.shotsFired.value, 8);
  assert.equal(weapon.damage.value, 80);
  assert.ok(weapon.directInputs.some(
    (entry) => entry.path === "weapon.minimumTemperature" && entry.value === -10,
  ));
});

test("does not invent an overheat limit when between-shot cooling offsets weapon heat", () => {
  const result = simulateFitting({
    components: [
      { id: "plant", componentType: "power_plant", powerCapacitySegments: 10 },
      {
        id: "self-cooling-ballistic",
        componentType: "ship_weapon",
        powerCategory: "weapons",
        nominalPowerDemandSegments: 1,
        weapon: {
          alphaDamage: 10,
          fireRateRpm: 60,
          ammoCapacity: 100,
          ammoCostPerShot: 1,
          heatPerShot: 5,
          minimumTemperature: 0,
          overheatTemperature: 100,
          coolingPerSecond: 10,
          coolingDelaySeconds: 0,
          overheatRecoverySeconds: 2,
          temperatureAfterOverheatRecovery: 20,
        },
      },
    ],
    powerAllocation: { weapons: 1 },
    durationSeconds: 12,
  });

  const weapon = result.weapons[0];
  assert.ok(weapon);
  assert.equal(weapon.maxShotsBeforeOverheat.value, null);
  assert.equal(weapon.overheatInterruptions.value, 0);
  assert.equal(weapon.overheatTimeSeconds.value, 0);
  assert.equal(weapon.shotsFired.value, 12);
});

test("refuses to reuse pilot capacitor values for an identified turret energy weapon", () => {
  const components = gladiusComponents();
  const weaponComponent = components.find((component) => component.weapon != null);
  assert.ok(weaponComponent);
  weaponComponent.weaponMountTopology = "turret";

  const result = simulateFitting({
    components,
    powerAllocation: gladiusAllocation(3 * 1.73),
    durationSeconds: 60,
  });
  const weapon = result.weapons[0];
  assert.ok(weapon);
  assert.equal(weapon.mountTopology, "turret");
  assert.equal(weapon.allocationRatio.value, null);
  assert.equal(weapon.effectiveAmmo.value, null);
  assert.equal(weapon.dps.value, null);
  assert.ok(weapon.missingInputs.some(
    (entry) => entry.path.includes("maxAmmoLoadMultiplier"),
  ));
  assert.ok(weapon.assumptions.some((entry) => entry.includes("Turret energy-weapon capacity")));
  assert.ok(result.weapons.every((entry) => entry.allocationRatio.value === null));
  assert.ok(result.weapons.every((entry) => entry.dps.value === null));
  assert.equal(result.power.allocatedSegments.value, null);
  assert.equal(result.power.marginSegments.value, null);
  assert.equal(result.cooling.demand.value, null);
  assert.equal(result.cooling.utilizationPercent.value, null);
  assert.ok(result.weapons[1]?.missingInputs.some(
    (entry) => entry.path === "ship.resourceNetwork.modifiers.powerRatioMultiplier",
  ));
});

test("requires explicit mount topology for an energy-weapon capacitor model", () => {
  const components = gladiusComponents();
  const firstWeapon = components.find((component) => component.weapon != null);
  assert.ok(firstWeapon);
  firstWeapon.weaponMountTopology = null;

  const result = simulateFitting({
    components,
    powerAllocation: gladiusAllocation(3 * 1.73),
  });

  assert.equal(result.weapons[0]?.dps.value, null);
  assert.ok(result.weapons[0]?.missingInputs.some(
    (entry) => entry.path === "ship.hardpoints.weaponMountTopology",
  ));
});

test("does not invent unavailable cooling values", () => {
  const components = gladiusComponents();
  const firstCooler = components.find((component) => component.id === "snowblind-1");
  assert.ok(firstCooler);
  firstCooler.coolingCapacity = null;

  const result = simulateFitting({
    components,
    powerAllocation: gladiusAllocation(1),
  });

  assert.equal(result.cooling.capacity.value, null);
  assert.equal(result.cooling.utilizationPercent.value, null);
  assert.ok(result.missingInputs.some((entry) => entry.path === "coolingCapacity"));
});

test("rejects negative power allocations", () => {
  assert.throws(
    () => simulateFitting({ components: gladiusComponents(), powerAllocation: { weapons: -1 } }),
    /finite nonnegative number/,
  );
});

test("suppresses dependent results when allocation exceeds reactor capacity", () => {
  const result = simulateFitting({
    components: [
      { id: "plant-port", componentId: "plant", componentType: "power_plant", powerCapacitySegments: 1 },
      {
        id: "weapon-port",
        componentId: "weapon",
        componentType: "ship_weapon",
        powerCategory: "weapons",
        nominalPowerDemandSegments: 2,
        weapon: { alphaDamage: 10, fireRateRpm: 60, ammoCapacity: 60, ammoCostPerShot: 1, heatPerShot: 0 },
      },
    ],
    powerAllocation: { weapons: 2 },
  });

  assert.equal(result.power.marginSegments.value, -1);
  assert.equal(result.weaponsSummary.dps.value, null);
  assert.equal(result.cooling.demand.value, null);
  assert.ok(result.missingInputs.some((entry) => entry.path === "powerAllocation"));
});

test("preserves requested allocation provenance when effective allocation is demand-capped", () => {
  const result = simulateFitting({
    components: [
      { id: "plant", componentType: "power_plant", powerCapacitySegments: 10 },
      {
        id: "weapon",
        componentType: "ship_weapon",
        powerCategory: "weapons",
        nominalPowerDemandSegments: 1,
        weapon: { alphaDamage: 10, fireRateRpm: 60, ammoCapacity: 60, ammoCostPerShot: 1, heatPerShot: 0 },
      },
    ],
    powerAllocation: { weapons: 9 },
  });

  assert.equal(result.power.allocatedByCategory.weapons, 1);
  assert.ok(result.power.allocatedSegments.sources.some(
    (entry) => entry.path === "powerAllocation.weapons" && entry.value === 9,
  ));
});

test("derives no cooling output from an unpowered cooler", () => {
  const result = simulateFitting({
    components: [
      { id: "plant", componentType: "power_plant", powerCapacitySegments: 10 },
      {
        id: "cooler",
        componentType: "cooler",
        powerCategory: "cooler1",
        nominalPowerDemandSegments: 1,
        coolingCapacity: 24,
      },
    ],
    powerAllocation: { cooler1: 0 },
  });

  assert.equal(result.cooling.capacity.value, 0);
  assert.equal(result.cooling.utilizationPercent.value, null);
});

test("uses exact extracted cooler output at a partial allocation", () => {
  const result = simulateFitting({
    components: [
      { id: "plant", componentType: "power_plant", powerCapacitySegments: 10 },
      {
        id: "cooler",
        componentType: "cooler",
        powerCategory: "cooler1",
        nominalPowerDemandSegments: 4,
        coolingCapacity: 40,
        coolingCapacityByPowerAllocation: [
          { allocation: 1, capacity: 14 },
          { allocation: 2, capacity: 25 },
          { allocation: 3, capacity: 33 },
        ],
      },
    ],
    powerAllocation: { cooler1: 2 },
  });

  assert.equal(result.cooling.capacity.value, 25);
  assert.equal(result.cooling.demand.value, 2);
  assert.equal(result.cooling.utilizationPercent.value, 8);
});

test("does not interpolate an absent partial cooler output", () => {
  const result = simulateFitting({
    components: [
      { id: "plant", componentType: "power_plant", powerCapacitySegments: 10 },
      {
        id: "cooler",
        componentType: "cooler",
        powerCategory: "cooler1",
        nominalPowerDemandSegments: 4,
        coolingCapacity: 40,
      },
    ],
    powerAllocation: { cooler1: 2 },
  });

  assert.equal(result.cooling.capacity.value, null);
  assert.ok(result.missingInputs.some((entry) => entry.path === "coolingCapacityByPowerAllocation"));
});

test("does not duplicate a shared partial allocation across multiple coolers", () => {
  const result = simulateFitting({
    components: [
      { id: "plant", componentType: "power_plant", powerCapacitySegments: 10 },
      {
        id: "cooler-a",
        componentType: "cooler",
        powerCategory: "cooler2",
        nominalPowerDemandSegments: 1,
        coolingCapacity: 24,
      },
      {
        id: "cooler-b",
        componentType: "cooler",
        powerCategory: "cooler2",
        nominalPowerDemandSegments: 1,
        coolingCapacity: 24,
      },
    ],
    powerAllocation: { cooler2: 1 },
  });

  assert.equal(result.cooling.capacity.value, null);
  assert.ok(result.missingInputs.some(
    (entry) => entry.path === "powerAllocation.cooler2" && entry.reason.includes("no per-cooler distribution rule"),
  ));
});

test("includes shield power demand in the source-backed shields allocation channel", () => {
  const components = gladiusComponents();
  const baseline = simulateFitting({ components, powerAllocation: gladiusAllocation(3) });
  components.push({
    id: "shield-port",
    componentId: "shield",
    componentType: "shield",
    powerCategory: "shields",
    nominalPowerDemandSegments: 1,
    nominalPowerDemandUnitType: "PowerSegment",
  });
  const result = simulateFitting({
    components,
    powerAllocation: { ...gladiusAllocation(3), shields: 1 },
  });

  assert.equal(result.power.allocatedSegments.value, 6);
  assert.equal(result.cooling.demand.value, 6);
  assert.equal(result.weaponsSummary.dps.value, baseline.weaponsSummary.dps.value);
  assert.ok(result.power.allocatedSegments.sources.some(
    (entry) => entry.componentId === "allocation" && entry.path === "powerAllocation.shields" && entry.value === 1,
  ));
});

test("uses the exact extracted shield regeneration step for a single generator", () => {
  const result = simulateFitting({
    components: [
      { id: "plant", componentType: "power_plant", powerCapacitySegments: 10 },
      {
        id: "shield-port",
        componentId: "allstop",
        componentType: "shield",
        powerCategory: "shields",
        nominalPowerDemandSegments: 3,
        shield: {
          maxRegenPerSecond: 602,
          regenByPowerAllocation: [
            { allocation: 1, value: 140.4667 },
            { allocation: 2, value: 341.1333 },
            { allocation: 3, value: 602 },
          ],
        },
      },
    ],
    powerAllocation: { shields: 2 },
  });

  assert.equal(result.shields.maxRegenPerSecond.value, 602);
  assert.equal(result.shields.effectiveRegenPerSecond.value, 341.1333);
  assert.equal(result.shields.effectiveRegenPerSecond.formula, "exact extracted shield regeneration at assigned allocation");
  assert.ok(result.shields.effectiveRegenPerSecond.sources.some(
    (entry) => entry.componentId === "allstop" && entry.path === "shield.regenByPowerAllocation[allocation=2].value",
  ));
});

test("sums maximum regeneration only when multiple shield generators are fully powered", () => {
  const shield = (id: string): NormalizedFittingSimulationComponent => ({
    id: `${id}-port`,
    componentId: id,
    componentType: "shield",
    powerCategory: "shields",
    nominalPowerDemandSegments: 3,
    shield: {
      maxRegenPerSecond: 602,
      regenByPowerAllocation: [{ allocation: 3, value: 602 }],
    },
  });
  const components = [
    { id: "plant", componentType: "power_plant", powerCapacitySegments: 20 },
    shield("shield-a"),
    shield("shield-b"),
  ];

  const full = simulateFitting({ components, powerAllocation: { shields: 6 } });
  assert.equal(full.shields.maxRegenPerSecond.value, 1_204);
  assert.equal(full.shields.effectiveRegenPerSecond.value, 1_204);

  const partial = simulateFitting({ components, powerAllocation: { shields: 3 } });
  assert.equal(partial.shields.maxRegenPerSecond.value, 1_204);
  assert.equal(partial.shields.effectiveRegenPerSecond.value, null);
  assert.ok(partial.missingInputs.some(
    (entry) => entry.path === "powerAllocation.shields" && entry.reason.includes("no per-generator distribution rule"),
  ));
});

test("reports an unavailable single-generator step instead of interpolating", () => {
  const result = simulateFitting({
    components: [
      { id: "plant", componentType: "power_plant", powerCapacitySegments: 10 },
      {
        id: "shield-port",
        componentId: "shield",
        componentType: "shield",
        powerCategory: "shields",
        nominalPowerDemandSegments: 3,
        shield: {
          maxRegenPerSecond: 602,
          regenByPowerAllocation: [{ allocation: 3, value: 602 }],
        },
      },
    ],
    powerAllocation: { shields: 2 },
  });

  assert.equal(result.shields.effectiveRegenPerSecond.value, null);
  assert.ok(result.missingInputs.some(
    (entry) => entry.componentId === "shield" && entry.path === "shield.regenByPowerAllocation",
  ));
});

test("suppresses overall and weapon results for a genuinely unmapped powered consumer", () => {
  const components = gladiusComponents();
  components.push({
    id: "controller-port",
    componentId: "controller",
    componentType: "flight_controller",
    nominalPowerDemandSegments: 1,
  });
  const result = simulateFitting({ components, powerAllocation: gladiusAllocation(3) });

  assert.equal(result.power.allocatedSegments.value, null);
  assert.equal(result.weaponsSummary.dps.value, null);
  assert.ok(result.missingInputs.some((entry) => entry.componentId === "controller" && entry.path === "powerCategory"));
});

test("keeps a weapon offline below its extracted minimum power input", () => {
  const result = simulateFitting({
    components: [
      { id: "plant", componentType: "power_plant", powerCapacitySegments: 10 },
      {
        id: "weapon",
        componentType: "ship_weapon",
        powerCategory: "weapons",
        nominalPowerDemandSegments: 2,
        minimumPowerDemandSegments: 1.5,
        weapon: { alphaDamage: 10, fireRateRpm: 60, ammoCapacity: 60, ammoCostPerShot: 1, heatPerShot: 0 },
      },
    ],
    powerAllocation: { weapons: 1 },
  });

  assert.equal(result.weapons[0]?.shotsFired.value, 0);
  assert.equal(result.weapons[0]?.dps.value, 0);
  assert.ok(result.weapons[0]?.assumptions.some((entry) => entry.includes("minimum-online")));
});

test("reports actual component identity separately from its mount", () => {
  const components = gladiusComponents();
  const weapon = components.find((component) => component.weapon != null);
  assert.ok(weapon);
  weapon.componentId = "quarreler-component";
  weapon.id = "weapon-mount-1";

  const result = simulateFitting({
    components,
    powerAllocation: gladiusAllocation(3),
  });
  const simulated = result.weapons.find((entry) => entry.componentId === "quarreler-component");

  assert.equal(simulated?.mountId, "weapon-mount-1");
  assert.ok(simulated?.directInputs.some(
    (entry) => entry.componentId === "quarreler-component" && entry.mountId === "weapon-mount-1",
  ));
});
