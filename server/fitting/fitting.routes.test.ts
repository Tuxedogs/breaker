import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import fittingVercelHandler from "../../api/v1/fitting/[...path].ts";
import { canonicalId } from "./fitting.service.ts";
import { PUBLIC_REGISTRIES } from "./registryStore.ts";
import { handleFittingRoute } from "../routes/fitting.routes.ts";
import { runFittingApiHandler } from "../routes/fittingApi.ts";

const shipId = "0079c5d5-1678-4f8c-85ba-18ca8f642af6";
const componentId = "1f5be5de-b5ea-42c7-879f-289c4bf64f19";
const weaponId = "44444444-4444-4444-8444-444444444444";
const powerPlantId = "55555555-5555-4555-8555-555555555555";
const shieldId = "22222222-2222-4222-8222-222222222222";
const ammoId = "031a120e-db07-4100-8071-50346731964b";
const missileId = "66666666-6666-4666-8666-666666666666";
const torpedoId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const missileRackId = "77777777-7777-4777-8777-777777777777";
const bombId = "88888888-8888-4888-8888-888888888888";
const bombRackId = "99999999-9999-4999-8999-999999999999";

function envelope(registry: string, records: Record<string, unknown>[]) {
  return {
    buildId: "test-build",
    channel: "LIVE",
    generatedAt: "2026-06-24T00:00:00Z",
    recordCount: records.length,
    records,
    registry,
    schemaVersion: 1,
    ...(registry === "ship_weapons" ? { recordSchemaVersion: 2 } : {}),
  };
}

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "scintel-fitting-api-"));
  const fittingRoot = path.join(root, "LIVE", "test-build");
  await mkdir(fittingRoot, { recursive: true });
  await writeFile(path.join(root, "current.json"), `${JSON.stringify({ schemaVersion: 1, channels: { LIVE: { currentBuildId: "test-build" } } }, null, 2)}\n`, "utf8");
  const records: Record<string, Record<string, unknown>[]> = Object.fromEntries(PUBLIC_REGISTRIES.map((name) => [name, []]));
  records["ships.json"] = [
    { entityClass: shipId, shipKey: shipId, name: "Test Ship", displayName: "Test Ship", vehicleType: "Spaceship", isGroundVehicle: false, confidence: "high", sourceFile: "D:/private/foundry/test-ship.xml" },
    { entityClass: "11111111-1111-4111-8111-111111111111", shipKey: "11111111-1111-4111-8111-111111111111", name: "Second Ship", displayName: "Second Ship", vehicleType: "Spaceship", isGroundVehicle: false, confidence: "high" },
  ];
  records["ship_performance.json"] = [{ shipKey: shipId, scmSpeed: 200, confidence: "high" }];
  records["ship_hardpoints.json"] = [{
    shipKey: shipId,
    confidence: "high",
    resourceNetworkPowerPools: {
      fixed: [{
        itemType: "WeaponGun",
        poolSize: 4,
        sourcePath: "SItemPortContainerComponentParams/resourceNetworkPowerPools/itemPools/FixedPowerPool[@itemType='WeaponGun']/@poolSize",
      }],
      dynamic: [],
    },
    tree: [
      { id: "power/main", portId: "power/main", portName: "Power plant", portType: "PowerPlant", editable: true, children: [] },
      { id: "cooler/main", portId: "cooler/main", portName: "Cooler", portType: "Cooler", editable: true, children: [] },
      { id: "shield/main", portId: "shield/main", portName: "Shield", portType: "Shield", editable: true, children: [] },
      { id: "weapon/main", portId: "weapon/main", portName: "Main weapon", portType: "WeaponGun", editable: true, children: [], confidence: "high", resolvedDefaultComponentKey: componentId.replaceAll("-", "_") },
      {
        id: "turret/main",
        portId: "turret/main",
        portName: "Main turret",
        portType: "Turret",
        portSubType: "BottomTurret",
        children: [{
          id: "turret/main/gimbal",
          portId: "turret/main/gimbal",
          portName: "Turret gimbal",
          portType: "Turret",
          portSubType: "GunTurret",
          children: [{ id: "turret/main/gimbal/weapon", portId: "turret/main/gimbal/weapon", portName: "Turret weapon", portType: "WeaponGun", children: [] }],
        }],
      },
    ],
  }];
  records["default_loadouts.json"] = [{ shipKey: shipId, confidence: "high", entries: [{ portPath: "weapon/main", resolvedDefaultComponentKey: componentId.replaceAll("-", "_"), confidence: "high" }] }];
  records["stock_loadout_calculations.json"] = [{ shipKey: shipId, loadoutResolutionStatus: "resolved", componentCountsByType: { cooler: 1 }, categories: { power: { available: true, confidence: "high", unavailableReason: null, derived: { powerSurplus: 2 } } }, warnings: [], confidence: "high" }];
  records["compatible_items_by_port.json"] = [{ shipKey: shipId, ports: { "weapon/main": { portId: "weapon/main", compatibilityStatus: "known", compatibleComponentKeys: [componentId.replaceAll("-", "_")], portType: "Cooler", editable: true } } }];
  records["coolers.json"] = [{ entityClass: componentId, componentKey: componentId.replaceAll("-", "_"), name: "Test Cooler", displayName: "Test Cooler", componentType: "cooler", size: 1, coolingGenerated: 10, powerInputMaximum: 1, powerDraw: 1, confidence: "high" }];
  records["power_plants.json"] = [{ entityClass: powerPlantId, componentKey: powerPlantId.replaceAll("-", "_"), name: "Test Plant", displayName: "Test Plant", componentType: "power_plant", size: 1, powerGenerated: 10, confidence: "high" }];
  records["ship_weapons.json"] = [{
    entityClass: weaponId,
    componentKey: weaponId.replaceAll("-", "_"),
    name: "Test Weapon",
    displayName: "Test Weapon",
    componentType: "ship_weapon",
    recordSchemaVersion: 2,
    alphaDamageTotal: 100,
    theoreticalDps: 200,
    damageOver60Seconds: 9000,
    sustainedDps60: 150,
    dps: 150,
    dpsModelVersion: "foundry-weapon-dps-v1",
    dpsAssumptions: ["single_selected_fire_action"],
    dpsConfidence: "medium",
    powerConsumptionNominal: 1,
    fireRateRpm: 120,
    ammoCostPerShot: 1,
    maxAmmoLoad: 10,
    maxRegenPerSec: 2,
    regenerationCooldown: 1,
    heatPerShot: 0,
    maxAmmoCount: 90,
    spreadMin: 0.1,
    spreadMax: 0.2,
    coolingPerSecond: 12,
    fireActions: [{ kind: "rapid", actionIndex: 0, sourcePath: "weapon/action", fireRateRpm: 120, spinUpTime: 0.5, fireDuringSpinUp: true }],
    confidence: "high",
  }];
  records["missiles.json"] = [
    {
      entityClass: missileId,
      componentKey: missileId,
      name: "Test Missile",
      displayName: "Test Missile",
      componentType: "missile",
      itemType: "Missile",
      ordnanceClass: "Missile",
      size: 2,
      alphaDamageTotal: 1440,
      damagePhysical: 1440,
      explosionRadiusMin: 7,
      explosionRadiusMax: 8,
      lockRangeMax: 10000,
      trackingSignalType: "Infrared",
      confidence: "high",
    },
    {
      entityClass: torpedoId,
      componentKey: torpedoId,
      name: "Test Torpedo",
      displayName: "Test Torpedo",
      componentType: "missile",
      itemType: "Missile",
      ordnanceClass: "Torpedo",
      size: 5,
      alphaDamageTotal: 9000,
      damagePhysical: 9000,
      confidence: "high",
    },
  ];
  records["missile_racks.json"] = [{
    entityClass: missileRackId,
    componentKey: missileRackId,
    name: "Test Rack",
    displayName: "Test Rack",
    componentType: "missile_rack",
    itemType: "MissileLauncher",
    size: 3,
    launchDelay: 0.125,
    missileSlotCount: 2,
    supportedMissileSizes: [2],
    missilePorts: [
      { name: "missile_01_attach", minSize: 2, maxSize: 2 },
      { name: "missile_02_attach", minSize: 2, maxSize: 2 },
    ],
    confidence: "high",
  }];
  records["bombs.json"] = [{
    entityClass: bombId,
    componentKey: bombId,
    name: "Test Bomb",
    displayName: "Test Bomb",
    componentType: "bomb",
    itemType: "Bomb",
    size: 5,
    alphaDamageTotal: 50000,
    damagePhysical: 20000,
    damageEnergy: 30000,
    explosionRadiusMin: 100,
    explosionRadiusMax: 100,
    maximumDropAngleFromFlatFlight: 90,
    confidence: "high",
  }];
  records["bomb_racks.json"] = [{
    entityClass: bombRackId,
    componentKey: bombRackId,
    name: "Test Bomb Rack",
    displayName: "Test Bomb Rack",
    componentType: "bomb_rack",
    itemType: "BombLauncher",
    size: 5,
    launchDelay: 0.125,
    bombSlotCount: 1,
    supportedBombSizes: [5],
    bombPorts: [{ name: "bomb_01_attach", minSize: 5, maxSize: 5 }],
    confidence: "high",
  }];
  records["shields.json"] = [{
    entityClass: shieldId,
    componentKey: shieldId,
    name: "Test Shield",
    displayName: "Test Shield",
    componentType: "shield",
    shieldHP: 100,
    regenRate: 12,
    maxShieldRegen: 12,
    shieldRegenByPowerPip: [
      { pips: 1, value: 5 },
      { pips: 2, value: 12 },
    ],
    powerInputMaximum: 2,
    powerInputUnitType: "PowerSegment",
    powerDraw: 1,
    shieldResistanceByDamageType: { physical: { min: 0, max: 0.25, confidence: "high", sourcePath: "shield/resistance" } },
    shieldAbsorptionByDamageType: { physical: { min: 0, max: 0.45, confidence: "high", sourcePath: "shield/absorption" } },
    confidence: "high",
  }];
  records["ship_armors.json"] = [{
    entityClass: "33333333-3333-4333-8333-333333333333",
    componentKey: "33333333-3333-4333-8333-333333333333",
    name: "Test Armor",
    displayName: "Test Armor",
    componentType: "armor",
    health: 250,
    basePenetrationReduction: 1,
    armorDeflectionThresholdByDamageType: { physical: { value: 9, confidence: "high", sourcePath: "armor/deflection" } },
    armorResistanceByDamageType: { physical: { multiplier: 0.8, threshold: 0, damageCap: 0, confidence: "high", sourcePath: "armor/resistance" } },
    confidence: "high",
  }];
  records["vehicle_ammo.json"] = [{ ammoParamsRecord: ammoId, ammoKey: ammoId.replaceAll("-", "_"), alphaDamageTotal: 10, damagePhysical: 10, basePenetrationDistance: 0.66, maxPenetrationThickness: 0.5, confidence: "high" }];

  await Promise.all(PUBLIC_REGISTRIES.map(async (name) => {
    await writeFile(path.join(fittingRoot, name), `${JSON.stringify(envelope(name.replace(/\.json$/, ""), records[name]), null, 2)}\n`, "utf8");
  }));
  return root;
}

test("normalizes underscore UUID compatibility aliases", () => {
  assert.equal(canonicalId(componentId.replaceAll("-", "_")), componentId);
});

test("older datasets remain readable when additive ordnance registries are absent", async () => {
  const root = await fixtureRoot();
  const fittingRoot = path.join(root, "LIVE", "test-build");
  try {
    await unlink(path.join(fittingRoot, "missiles.json"));
    await unlink(path.join(fittingRoot, "missile_racks.json"));
    await unlink(path.join(fittingRoot, "bombs.json"));
    await unlink(path.join(fittingRoot, "bomb_racks.json"));
    const meta = await handleFittingRoute("GET", "/api/v1/fitting/meta?channel=LIVE&buildId=test-build", "test-request", root);
    const components = await handleFittingRoute("GET", "/api/v1/fitting/components?channel=LIVE&buildId=test-build", "test-request", root);
    assert.equal(meta?.status, 200, JSON.stringify(meta?.body));
    assert.equal(components?.status, 200, JSON.stringify(components?.body));
    assert.equal(JSON.stringify(meta?.body).includes("missiles"), false);
    assert.equal(JSON.stringify(meta?.body).includes("bombs"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("exposes shaped mitigation data without raw registry dumps", async () => {
  const root = await fixtureRoot();
  const query = "channel=LIVE&buildId=test-build";
  try {
    const meta = await handleFittingRoute("GET", `/api/v1/fitting/meta?${query}`, "test-request", root);
    const registries = ((meta?.body as { data: { registries: Array<{ name: string }> } }).data.registries);
    assert.ok(registries.some((entry) => entry.name === "ship_armors"));

    const ship = await handleFittingRoute("GET", `/api/v1/fitting/ships/${shipId}?${query}`, "test-request", root);
    assert.equal((ship?.body as { data: { mitigation: { hullHp: number | null } } }).data.mitigation.hullHp, null);
    assert.equal(JSON.stringify(ship?.body).includes("sourceFile"), false);
    assert.equal(JSON.stringify(ship?.body).includes(root), false);

    const shield = await handleFittingRoute("GET", `/api/v1/fitting/components/22222222-2222-4222-8222-222222222222?${query}`, "test-request", root);
    assert.equal((shield?.body as { data: { mitigation: { kind: string; resistanceByDamageType: { physical: { max: number } } } } }).data.mitigation.kind, "shield");
    assert.equal((shield?.body as { data: { mitigation: { resistanceByDamageType: { physical: { max: number } } } } }).data.mitigation.resistanceByDamageType.physical.max, 0.25);
    assert.equal(JSON.stringify(shield?.body).includes("sourceFile"), false);

    const armor = await handleFittingRoute("GET", `/api/v1/fitting/components/33333333-3333-4333-8333-333333333333?${query}`, "test-request", root);
    assert.equal((armor?.body as { data: { type: string; mitigation: { kind: string; deflectionThresholdByDamageType: { physical: { value: number } } } } }).data.type, "armor");
    assert.equal((armor?.body as { data: { mitigation: { deflectionThresholdByDamageType: { physical: { value: number } } } } }).data.mitigation.deflectionThresholdByDamageType.physical.value, 9);

    const ammo = await handleFittingRoute("GET", `/api/v1/fitting/ammo/${ammoId}?${query}`, "test-request", root);
    assert.equal((ammo?.body as { data: { mitigation: { basePenetrationDistance: number | null } } }).data.mitigation.basePenetrationDistance, 0.66);

    const missile = await handleFittingRoute("GET", `/api/v1/fitting/components/${missileId}?${query}`, "test-request", root);
    assert.equal((missile?.body as { data: { stats: { explosionRadiusMax: number }; ordnance: { kind: string; trackingSignalType: string } } }).data.stats.explosionRadiusMax, 8);
    assert.equal((missile?.body as { data: { ordnance: { kind: string } } }).data.ordnance.kind, "missile");
    assert.equal((missile?.body as { data: { ordnance: { trackingSignalType: string } } }).data.ordnance.trackingSignalType, "Infrared");
    assert.equal((missile?.body as { data: { ordnance: { requiresLauncher: boolean | null } } }).data.ordnance.requiresLauncher, null);

    const rack = await handleFittingRoute("GET", `/api/v1/fitting/components/${missileRackId}?${query}`, "test-request", root);
    assert.deepEqual((rack?.body as { data: { ordnance: { supportedOrdnanceSizes: number[] } } }).data.ordnance.supportedOrdnanceSizes, [2]);
    assert.equal((rack?.body as { data: { ordnance: { ports: unknown[] } } }).data.ordnance.ports.length, 2);

    const bomb = await handleFittingRoute("GET", `/api/v1/fitting/components/${bombId}?${query}`, "test-request", root);
    assert.equal((bomb?.body as { data: { ordnance: { kind: string } } }).data.ordnance.kind, "bomb");
    assert.equal((bomb?.body as { data: { stats: { alphaDamage: number } } }).data.stats.alphaDamage, 50000);
    assert.equal((bomb?.body as { data: { stats: { maximumDropAngleFromFlatFlight: number } } }).data.stats.maximumDropAngleFromFlatFlight, 90);

    const bombRack = await handleFittingRoute("GET", `/api/v1/fitting/components/${bombRackId}?${query}`, "test-request", root);
    assert.equal((bombRack?.body as { data: { ordnance: { kind: string } } }).data.ordnance.kind, "bomb_rack");
    assert.deepEqual((bombRack?.body as { data: { ordnance: { supportedOrdnanceSizes: number[] } } }).data.ordnance.supportedOrdnanceSizes, [5]);

    const bombList = await handleFittingRoute("GET", `/api/v1/fitting/components?${query}&type=bomb`, "test-request", root);
    assert.equal(bombList?.status, 200);
    assert.equal((bombList?.body as { data: Array<{ id: string }> }).data.length, 1);
    assert.equal((bombList?.body as { data: Array<{ id: string }> }).data[0]?.id, bombId);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("implements the ten read-only v1 fitting routes", async () => {
  const root = await fixtureRoot();
  const query = "channel=LIVE&buildId=test-build";
  const paths = [
    "/api/v1/fitting/meta?channel=LIVE",
    `/api/v1/fitting/ships?${query}`,
    `/api/v1/fitting/ships/${shipId}?${query}&include=diagnostics`,
    `/api/v1/fitting/ships/${shipId}/hardpoints?${query}`,
    `/api/v1/fitting/ships/${shipId}/loadout?${query}`,
    `/api/v1/fitting/ships/${shipId}/calculations?${query}`,
    `/api/v1/fitting/ships/${shipId}/ports/weapon%2Fmain/compatible-components?${query}`,
    `/api/v1/fitting/components?${query}`,
    `/api/v1/fitting/components/${componentId.replaceAll("-", "_")}?${query}`,
    `/api/v1/fitting/ammo/${ammoId}?${query}`,
  ];
  try {
    for (const requestPath of paths) {
      const response = await handleFittingRoute("GET", requestPath, "test-request", root);
      assert.equal(response?.status, 200, requestPath);
      assert.equal(response?.headers?.["x-scintel-api-version"], "1");
      const serialized = JSON.stringify(response?.body);
      assert.equal(serialized.includes(root), false);
      assert.equal(serialized.includes("sourceFile"), false);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("keeps read routes read-only and supports POST validate/calculate", async () => {
  const known = await handleFittingRoute("POST", "/api/v1/fitting/ships", "test-request");
  assert.equal(known?.status, 405);
  assert.equal((known?.body as { code: string }).code, "METHOD_NOT_ALLOWED");

  const root = await fixtureRoot();
  const loadoutPayload = {
    shipId,
    loadout: {
      "weapon/main": componentId,
      "unknown/port": null,
    },
    options: { compareToStock: false },
  };
  try {
    const validate = await handleFittingRoute("POST", "/api/v1/fitting/validate?channel=LIVE&buildId=test-build", "test-request", root, loadoutPayload);
    assert.equal(validate?.status, 200);
    assert.equal((validate?.body as { data: { valid: boolean } }).data.valid, false);

    const calculate = await handleFittingRoute("POST", "/api/v1/fitting/calculate?channel=LIVE&buildId=test-build", "test-request", root, {
      shipId: shipId,
      loadout: { "weapon/main": componentId },
      options: { compareToStock: false },
    });
    assert.equal(calculate?.status, 200);
    assert.equal((calculate?.body as { data: { scope: string } }).data.scope, "custom_loadout");
    assert.equal("simulation" in (calculate?.body as { data: Record<string, unknown> }).data, false);

    const ordnance = await handleFittingRoute("POST", "/api/v1/fitting/calculate?channel=LIVE&buildId=test-build", "test-request", root, {
      shipId,
      loadout: { "missile/main": missileId, "torpedo/main": torpedoId, "bomb/main": bombId },
      options: { compareToStock: false },
    });
    assert.equal(ordnance?.status, 200);
    const ordnanceData = (ordnance?.body as {
      data: {
        categories: { ordnance: { derived: { missilePayloadDamage: number; torpedoPayloadDamage: number; bombPayloadDamage: number; totalOrdnancePayloadDamage: number } } };
        summary: { ordnance: { installedMissileCount: number; installedTorpedoCount: number; installedBombCount: number } };
      };
    }).data;
    assert.equal(ordnanceData.categories.ordnance.derived.missilePayloadDamage, 1440);
    assert.equal(ordnanceData.categories.ordnance.derived.torpedoPayloadDamage, 9000);
    assert.equal(ordnanceData.categories.ordnance.derived.bombPayloadDamage, 50000);
    assert.equal(ordnanceData.categories.ordnance.derived.totalOrdnancePayloadDamage, 60440);
    assert.equal(ordnanceData.summary.ordnance.installedMissileCount, 1);
    assert.equal(ordnanceData.summary.ordnance.installedTorpedoCount, 1);
    assert.equal(ordnanceData.summary.ordnance.installedBombCount, 1);
    assert.equal((ordnance?.body as { data: { categories: { weapons: { derived: { weaponAlphaTotal: number | null } } } } }).data.categories.weapons.derived.weaponAlphaTotal, null);

    const simulated = await handleFittingRoute("POST", "/api/v1/fitting/calculate?channel=LIVE&buildId=test-build", "test-request", root, {
      shipId,
      loadout: {
        "power/main": powerPlantId,
        "cooler/main": componentId,
        "shield/main": shieldId,
        "weapon/main": weaponId,
      },
      options: { compareToStock: false },
      simulation: {
        modelVersion: "fitting-simulation-v1",
        durationSeconds: 60,
        powerAllocation: { weapons: 1, engines: 0, quantum: 0, radar: 0, shields: 1, lifeSupport: 0, cooler1: 1, cooler2: 0 },
      },
    });
    assert.equal(simulated?.status, 200);
    const simulation = (simulated?.body as {
      data: {
        simulation: {
          power: {
            capacitySegments: { value: number };
            weaponPoolCapacitySegments: { value: number; sources: Array<{ path: string; value: number }> };
            allocatedSegments: { value: number; sources: Array<{ path: string; value: number }> };
          };
          cooling: { utilizationPercent: { value: number } };
          shields: {
            maxRegenPerSecond: { value: number };
            effectiveRegenPerSecond: { value: number; sources: Array<{ path: string; value: number }> };
          };
          weaponsSummary: { dps: { value: number }; totalDamage: { value: number } };
        };
      };
    }).data.simulation;
    assert.equal(simulation.power.capacitySegments.value, 10);
    assert.equal(simulation.power.weaponPoolCapacitySegments.value, 4);
    assert.ok(simulation.power.weaponPoolCapacitySegments.sources.some(
      (entry) => entry.path.includes("FixedPowerPool") && entry.value === 4,
    ));
    assert.equal(simulation.power.allocatedSegments.value, 3);
    assert.equal(simulation.cooling.utilizationPercent.value, 30);
    assert.equal(simulation.shields.maxRegenPerSecond.value, 12);
    assert.equal(simulation.shields.effectiveRegenPerSecond.value, 5);
    assert.ok(simulation.shields.effectiveRegenPerSecond.sources.some(
      (entry) => entry.path === "shieldRegenByPowerPip[0].value" && entry.value === 5,
    ));
    assert.ok(simulation.power.allocatedSegments.sources.some(
      (entry: { path: string; value: number }) => entry.path === "powerAllocation.shields" && entry.value === 1,
    ));
    assert.equal(simulation.weaponsSummary.totalDamage.value, 6000);
    assert.equal(simulation.weaponsSummary.dps.value, 100);
    assert.equal(JSON.stringify(simulated?.body).includes("sourceFile"), false);

    const turretSimulated = await handleFittingRoute("POST", "/api/v1/fitting/calculate?channel=LIVE&buildId=test-build", "test-request", root, {
      shipId,
      loadout: {
        "power/main": powerPlantId,
        "turret/main/gimbal/weapon": weaponId,
      },
      options: { compareToStock: false },
      simulation: {
        modelVersion: "fitting-simulation-v1",
        durationSeconds: 60,
        powerAllocation: { weapons: 1, engines: 0, quantum: 0, radar: 0, shields: 0, lifeSupport: 0, cooler1: 0, cooler2: 0 },
      },
    });
    assert.equal(turretSimulated?.status, 200);
    const turretSimulation = (turretSimulated?.body as {
      data: {
        simulation: {
          weapons: Array<{
            mountTopology: string | null;
            allocationRatio: { value: number | null };
            dps: { value: number | null };
            missingInputs: Array<{ path: string }>;
          }>;
          weaponsSummary: { dps: { value: number | null } };
        };
      };
    }).data.simulation;
    assert.equal(turretSimulation.weapons[0]?.mountTopology, "turret");
    assert.equal(turretSimulation.weapons[0]?.allocationRatio.value, null);
    assert.equal(turretSimulation.weapons[0]?.dps.value, null);
    assert.equal(turretSimulation.weaponsSummary.dps.value, null);
    assert.ok(turretSimulation.weapons[0]?.missingInputs.some(
      (entry) => entry.path.includes("maxAmmoLoadMultiplier"),
    ));
    assert.ok(turretSimulation.weapons[0]?.missingInputs.some(
      (entry) => entry.path.includes("powerRatioMultiplier"),
    ));

    const legacySevenChannelSimulation = await handleFittingRoute("POST", "/api/v1/fitting/calculate?channel=LIVE&buildId=test-build", "test-request", root, {
      shipId,
      loadout: {
        "power/main": powerPlantId,
        "cooler/main": componentId,
        "shield/main": shieldId,
        "weapon/main": weaponId,
      },
      simulation: {
        modelVersion: "fitting-simulation-v1",
        durationSeconds: 60,
        powerAllocation: { weapons: 1, engines: 0, quantum: 0, radar: 0, lifeSupport: 0, cooler1: 1, cooler2: 0 },
      },
    });
    assert.equal(legacySevenChannelSimulation?.status, 200);
    assert.equal(
      (legacySevenChannelSimulation?.body as { data: { simulation: { power: { allocatedByCategory: { shields: number } } } } }).data.simulation.power.allocatedByCategory.shields,
      0,
    );
    const legacySimulation = (legacySevenChannelSimulation?.body as {
      data: {
        simulation: {
          power: { allocatedSegments: { sources: Array<{ path: string }> } };
          shields: { effectiveRegenPerSecond: { value: number } };
          assumptions: string[];
        };
      };
    }).data.simulation;
    assert.equal(
      legacySimulation.power.allocatedSegments.sources.some((entry) => entry.path === "powerAllocation.shields"),
      false,
    );
    assert.equal(legacySimulation.shields.effectiveRegenPerSecond.value, 0);
    assert.ok(legacySimulation.assumptions.some((assumption) => assumption.includes("powerAllocation.shields") && assumption.includes("defaulted to 0")));

    const invalidSimulation = await handleFittingRoute("POST", "/api/v1/fitting/calculate?channel=LIVE&buildId=test-build", "test-request", root, {
      shipId,
      loadout: {},
      simulation: {
        modelVersion: "future-model",
        durationSeconds: 60,
        powerAllocation: {},
      },
    });
    assert.equal(invalidSimulation?.status, 400);

    const partialAllocation = await handleFittingRoute("POST", "/api/v1/fitting/calculate?channel=LIVE&buildId=test-build", "test-request", root, {
      shipId,
      loadout: {},
      simulation: {
        modelVersion: "fitting-simulation-v1",
        durationSeconds: 60,
        powerAllocation: { weapons: 1 },
      },
    });
    assert.equal(partialAllocation?.status, 400);

    const oversizedSimulation = await handleFittingRoute("POST", "/api/v1/fitting/calculate?channel=LIVE&buildId=test-build", "test-request", root, {
      shipId,
      loadout: Object.fromEntries(Array.from({ length: 513 }, (_, index) => [`port/${index}`, null])),
      simulation: {
        modelVersion: "fitting-simulation-v1",
        durationSeconds: 60,
        powerAllocation: { weapons: 0, engines: 0, quantum: 0, radar: 0, shields: 0, lifeSupport: 0, cooler1: 0, cooler2: 0 },
      },
    });
    assert.equal(oversizedSimulation?.status, 400);

    const unknownPortSimulation = await handleFittingRoute("POST", "/api/v1/fitting/calculate?channel=LIVE&buildId=test-build", "test-request", root, {
      shipId,
      loadout: { "fake/weapon": weaponId },
      simulation: {
        modelVersion: "fitting-simulation-v1",
        durationSeconds: 60,
        powerAllocation: { weapons: 1, engines: 0, quantum: 0, radar: 0, shields: 0, lifeSupport: 0, cooler1: 0, cooler2: 0 },
      },
    });
    assert.equal(unknownPortSimulation?.status, 400);

    const invalidShip = await handleFittingRoute("POST", "/api/v1/fitting/validate?channel=LIVE&buildId=test-build", "test-request", root, {
      shipId: "99999999-9999-4999-8999-999999999999",
      loadout: {},
    });
    assert.equal(invalidShip?.status, 404);

    const invalidItem = await handleFittingRoute("POST", "/api/v1/fitting/validate?channel=LIVE&buildId=test-build", "test-request", root, {
      shipId: shipId,
      loadout: { "weapon/main": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    });
    assert.equal(invalidItem?.status, 200);
    assert.equal((invalidItem?.body as { data: { unknownItemIds: unknown[] } }).data.unknownItemIds.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("binds cursors to route filters and rejects unknown query parameters", async () => {
  const root = await fixtureRoot();
  const base = "/api/v1/fitting/ships?channel=LIVE&buildId=test-build&limit=1";
  try {
    const first = await handleFittingRoute("GET", base, "test-request", root);
    const cursor = ((first?.body as { page: { nextCursor: string } }).page.nextCursor);
    assert.ok(cursor);
    const second = await handleFittingRoute("GET", `${base}&cursor=${encodeURIComponent(cursor)}`, "test-request", root);
    assert.equal(second?.status, 200);
    const stale = await handleFittingRoute("GET", `${base}&q=changed&cursor=${encodeURIComponent(cursor)}`, "test-request", root);
    assert.equal(stale?.status, 400);
    assert.equal((stale?.body as { code: string }).code, "CURSOR_INVALID");
    const unknown = await handleFittingRoute("GET", `${base}&raw=true`, "test-request", root);
    assert.equal(unknown?.status, 400);
    assert.equal((unknown?.body as { code: string }).code, "INVALID_REQUEST");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Vercel adapter supports GET, HEAD, ETag/304 and POST validate/calculate", async () => {
  const root = await fixtureRoot();
  const previousRoot = process.env.FITTING_DATA_ROOT;
  process.env.FITTING_DATA_ROOT = root;
  const server = createServer((request, response) => void runFittingApiHandler(request, response));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}/api/v1/fitting`;
    const meta = await fetch(`${base}/meta?channel=LIVE`);
    assert.equal(meta.status, 200);
    const ships = await fetch(`${base}/ships?channel=LIVE&buildId=test-build&limit=1`);
    assert.equal(ships.status, 200);
    const etag = ships.headers.get("etag");
    assert.ok(etag);
    const components = await fetch(`${base}/components?channel=LIVE&buildId=test-build&limit=1`);
    assert.equal(components.status, 200);
    const head = await fetch(`${base}/ships?channel=LIVE&buildId=test-build&limit=1`, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal((await head.text()).length, 0);
    const notModified = await fetch(`${base}/ships?channel=LIVE&buildId=test-build&limit=1`, { headers: { "if-none-match": etag } });
    assert.equal(notModified.status, 304);
    const validate = await fetch(`${base}/validate?channel=LIVE&buildId=test-build`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shipId, loadout: { "weapon/main": componentId.replaceAll("-", "_") }, options: { compareToStock: false } }),
    });
    assert.equal(validate.status, 200);
    const calculate = await fetch(`${base}/calculate?channel=LIVE&buildId=test-build`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shipId, loadout: { "weapon/main": componentId.replaceAll("-", "_") }, options: { compareToStock: false } }),
    });
    assert.equal(calculate.status, 200);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (previousRoot === undefined) delete process.env.FITTING_DATA_ROOT;
    else process.env.FITTING_DATA_ROOT = previousRoot;
    await rm(root, { recursive: true, force: true });
  }
});

test("projects versioned weapon stats, actions, and DPS metadata", async () => {
  const root = await fixtureRoot();
  try {
    const response = await handleFittingRoute("GET", `/api/v1/fitting/components/${weaponId}?channel=LIVE&buildId=test-build`, "test-request", root);
    const data = (response?.body as { data: { stats: Record<string, number>; weapon: { recordSchemaVersion: number; dpsModelVersion: string; dpsAssumptions: string[]; actions: Array<Record<string, unknown>> } } }).data;
    assert.equal(data.stats.theoreticalDps, 200);
    assert.equal(data.stats.sustainedDps60, 150);
    assert.equal(data.stats.maxAmmoCount, 90);
    assert.equal(data.weapon.recordSchemaVersion, 2);
    assert.equal(data.weapon.dpsModelVersion, "foundry-weapon-dps-v1");
    assert.deepEqual(data.weapon.dpsAssumptions, ["single_selected_fire_action"]);
    assert.equal(data.weapon.actions[0]?.kind, "rapid");
    assert.equal(data.weapon.actions[0]?.fireDuringSpinUp, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Vercel catch-all adapter removes only the internal path query parameter", async () => {
  const root = await fixtureRoot();
  const previousRoot = process.env.FITTING_DATA_ROOT;
  process.env.FITTING_DATA_ROOT = root;
  const server = createServer((request, response) => void fittingVercelHandler(request, response));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}/api/v1/fitting`;
    const routes = [
      `${base}/meta?channel=LIVE&path=meta`,
      `${base}/ships?channel=LIVE&buildId=test-build&limit=1&path=ships`,
      `${base}/components?channel=LIVE&buildId=test-build&limit=1&path=components`,
      `${base}/components/${componentId}?channel=LIVE&buildId=test-build&path=components/${componentId}`,
      `${base}/ships/${shipId}/hardpoints?channel=LIVE&buildId=test-build&format=flat&path=ships/${shipId}/hardpoints`,
      `${base}/ships/${shipId}/loadout?channel=LIVE&buildId=test-build&include=diagnostics&path=ships/${shipId}/loadout`,
    ];

    for (const route of routes) {
      const response = await fetch(route);
      assert.equal(response.status, 200, route);
      assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
    }

    const missing = await fetch(`${base}/components/00000000-0000-4000-8000-000000000000?channel=LIVE&buildId=test-build&path=components/00000000-0000-4000-8000-000000000000`);
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get("content-type"), "application/problem+json; charset=utf-8");

    const unsupported = await fetch(`${base}/ships?channel=LIVE&buildId=test-build&limit=1&raw=true&path=ships`);
    assert.equal(unsupported.status, 400);
    assert.equal(unsupported.headers.get("content-type"), "application/problem+json; charset=utf-8");
    const problem = await unsupported.json() as { detail: string; errors: Array<{ path: string }> };
    assert.equal(problem.detail, "Unsupported query parameter: raw.");
    assert.equal(problem.errors[0]?.path, "query.raw");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (previousRoot === undefined) delete process.env.FITTING_DATA_ROOT;
    else process.env.FITTING_DATA_ROOT = previousRoot;
    await rm(root, { recursive: true, force: true });
  }
});
