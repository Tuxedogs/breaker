import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import fittingVercelHandler from "../../api/v1/fitting/[...path].ts";
import { canonicalId, componentStats } from "./fitting.service.ts";
import { PUBLIC_REGISTRIES } from "./registryStore.ts";
import { handleFittingRoute } from "../routes/fitting.routes.ts";
import { runFittingApiHandler } from "../routes/fittingApi.ts";

const shipId = "0079c5d5-1678-4f8c-85ba-18ca8f642af6";
const componentId = "1f5be5de-b5ea-42c7-879f-289c4bf64f19";
const weaponId = "44444444-4444-4444-8444-444444444444";
const powerPlantId = "55555555-5555-4555-8555-555555555555";
const quantumDriveId = "12121212-1212-4212-8212-121212121212";
const shieldId = "22222222-2222-4222-8222-222222222222";
const ammoId = "031a120e-db07-4100-8071-50346731964b";
const missileId = "66666666-6666-4666-8666-666666666666";
const torpedoId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const missileRackId = "77777777-7777-4777-8777-777777777777";
const bombId = "88888888-8888-4888-8888-888888888888";
const bombRackId = "99999999-9999-4999-8999-999999999999";
const templateMissileId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const missileControllerId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const radarId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const relayId = "f1111111-1111-4111-8111-111111111111";
const lifeSupportId = "f2222222-2222-4222-8222-222222222222";
const batteryId = "f3333333-3333-4333-8333-333333333333";
const empId = "f4444444-4444-4444-8444-444444444444";
const quantumInterdictionId = "f5555555-5555-4555-8555-555555555555";
const fuelTankId = "f6666666-6666-4666-8666-666666666666";
const fuelIntakeId = "f7777777-7777-4777-8777-777777777777";
const personalStorageId = "f8888888-8888-4888-8888-888888888888";
const miningModifierId = "f9999999-9999-4999-8999-999999999999";
const thrusterId = "fa111111-1111-4111-8111-111111111111";
const legacyVtolThrusterId = "fa222222-2222-4222-8222-222222222222";
const legacyNonVtolThrusterId = "fa333333-3333-4333-8333-333333333333";

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
  records["ship_performance.json"] = [{ shipKey: shipId, scmSpeed: 200, boostRegenDelayAfterUse: 0.2, confidence: "high" }];
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
      { id: "life_support/main", portId: "life_support/main", portName: "Life support", portType: "LifeSupportGenerator", editable: true, children: [] },
      { id: "fuel/main", portId: "fuel/main", portName: "Fuel tank", portType: "FuelTank", editable: true, children: [] },
      { id: "weapon/main", portId: "weapon/main", portName: "Main weapon", portType: "WeaponGun", editable: true, children: [], confidence: "high", resolvedDefaultComponentKey: componentId.replaceAll("-", "_") },
      { id: "missile/main", portId: "missile/main", portName: "Missile", portType: "Missile", editable: true, children: [] },
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
  records["compatible_items_by_port.json"] = [{ shipKey: shipId, ports: {
    "weapon/main": { portId: "weapon/main", compatibilityStatus: "known", compatibleComponentKeys: [componentId.replaceAll("-", "_")], portType: "Cooler", editable: true },
    "missile/main": { portId: "missile/main", compatibilityStatus: "known", compatibleComponentKeys: [missileId, templateMissileId], portType: "Missile", editable: true },
    "fuel/main": { portId: "fuel/main", compatibilityStatus: "known", compatibleComponentKeys: [fuelTankId], portType: "FuelTank", editable: true },
  } }];
  records["coolers.json"] = [{
    entityClass: componentId,
    componentKey: componentId.replaceAll("-", "_"),
    name: "Test Cooler",
    displayName: "Test Cooler",
    componentType: "cooler",
    size: 1,
    coolingGenerated: 10,
    powerInputMaximum: 1,
    powerInputMinimum: 0.5,
    minimumPowerRequired: 0.5,
    minimumPowerRequiredPips: 1,
    maximumPowerRequired: 1,
    maximumPowerRequiredPips: 2,
    powerInputMinimumFraction: 0.5,
    coolingCapacity: 20,
    coolingGenerationRate: 10,
    heatSink: 40,
    transferRate: 3,
    powerDraw: 1,
    electromagneticEmission: 250,
    emSignatureNominal: 250,
    emSignatureDecayRate: 0.15,
    selfRepairMaxCount: 1,
    selfRepairTime: 25.5,
    selfRepairHealthRatio: 0.2,
    selfRepairBaselineHp: 28,
    repairRestoreRatio: 0.1,
    thermalEqualizationRate: 3.75,
    coolingGeneratedByPowerPip: [
      { pips: 1, percentAssigned: 0.5, modifier: 0.7, range: "low", value: 10, privateSourcePath: "do/not/expose" },
      { pips: 2, percentAssigned: 1, modifier: 1, range: "high", value: 10 },
    ],
    coolingGeneratedPowerFormula: "maximumOutput * allocation",
    coolingGeneratedPowerFormulaConfidence: "source_backed_for_coolers",
    confidence: "high",
  }];
  records["power_plants.json"] = [{ entityClass: powerPlantId, componentKey: powerPlantId.replaceAll("-", "_"), name: "Test Plant", displayName: "Test Plant", componentType: "power_plant", size: 1, powerGenerated: 10, powerOutput: 12, powerCapacity: 20, powerGenerationRate: 11, confidence: "high" }];
  records["quantum_drives.json"] = [{
    entityClass: quantumDriveId,
    componentKey: quantumDriveId.replaceAll("-", "_"),
    name: "Test Quantum Drive",
    displayName: "Test Quantum Drive",
    componentType: "quantum_drive",
    quantumSpeed: 200000000,
    spoolTime: 4,
    quantumCooldown: 10,
    quantumFuelRequirement: 0,
    fuelRate: null,
    calibrationDelayInSeconds: 1.5,
    calibrationRate: 1000,
    calibrationTime: 11.5,
    minCalibrationRequirement: 5000,
    maxCalibrationRequirement: 10000,
    quantumStageOneAccelRate: 376000,
    quantumStageTwoAccelRate: 11200000,
    rangeEfficiency: 0.8,
    splineCooldown: 8,
    splineJumpSpeed: 9000,
    calibrationProcessAngleLimit: 15,
    calibrationWarningAngleLimit: 30,
    travellingEmSignature: 14,
    travellingIrSignature: 7,
    engageSpeed: 250,
    interdictionEffectTime: 5,
    confidence: "high",
  }];
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
    burstCount: 4,
    nearRadius: 0,
    farRadius: 5,
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
      selectionEligible: true,
      referenceStatus: "referenced",
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
    {
      entityClass: templateMissileId,
      componentKey: templateMissileId,
      name: "MISL_S10_Template",
      displayName: "Template Torpedo",
      componentType: "missile",
      itemType: "Missile",
      ordnanceClass: "Torpedo",
      size: 10,
      alphaDamageTotal: 10000,
      selectionEligible: false,
      referenceStatus: "unreferenced_template",
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
  records["missile_controllers.json"] = [{
    entityClass: missileControllerId,
    componentKey: missileControllerId,
    name: "Controller_Missile",
    displayName: "Missile Controller",
    componentType: "missile_controller",
    lockAngleAtMin: 18,
    lockAngleAtMax: 18,
    maxArmedMissiles: 4,
    launchCooldownTime: 4,
    selectionEligible: false,
    referenceStatus: "referenced_internal",
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
    damagedRegenDelay: 4,
    downedRegenDelay: 8,
    shieldRegenByPowerPip: [
      { pips: 1, value: 5 },
      { pips: 2, value: 12 },
    ],
    hardeningFactor: 0.2,
    reservePoolRegenRate: 2,
    reservePoolRegenTime: 8,
    powerInputMaximum: 2,
    powerInputUnitType: "PowerSegment",
    powerDraw: 1,
    shieldResistanceByDamageType: { physical: { min: 0, max: 0.25, confidence: "high", sourcePath: "shield/resistance" } },
    shieldAbsorptionByDamageType: { physical: { min: 0, max: 0.45, confidence: "high", sourcePath: "shield/absorption" } },
    confidence: "high",
  }];
  records["radars.json"] = [{
    entityClass: radarId,
    componentKey: radarId.replaceAll("-", "_"),
    name: "Test Radar",
    displayName: "Test Radar",
    componentType: "radar",
    aimAssistMinAssignmentDistance: 100,
    aimAssistMaxAssignmentDistance: 1000,
    aimAssistOutsideRangeBufferDistance: 25,
    confidence: "high",
  }];
  records["relays.json"] = [{
    entityClass: relayId,
    componentKey: relayId,
    name: "Test Relay",
    displayName: "Test Relay",
    componentType: "relay",
    relayResourceNetwork: {
      resourceNetworkItemType: "Relay",
      isResourceNetworked: true,
      isRelay: true,
      isConnectedToRoom: false,
      wirelessConnection: false,
      defaultPriority: 50,
      networkItemSourcePath: "private/relay/path",
    },
    confidence: "high",
  }];
  records["life_support.json"] = [{
    entityClass: lifeSupportId,
    componentKey: lifeSupportId,
    name: "Test Life Support",
    displayName: "Test Life Support",
    componentType: "life_support",
    powerInputMaximum: 1,
    powerInputMinimum: 1,
    powerInputUnitType: "PowerSegment",
    stateResourceDeltas: [{
      stateName: "Online",
      stateSourcePath: "private/state/path",
      deltas: [{
        deltaNode: "ItemResourceDeltaConversion",
        deltaSourcePath: "private/delta/path",
        minimumConsumptionFraction: 1,
        noOverGeneration: false,
        storageDischarge: null,
        resources: [
          { direction: "consumption", resource: "Power", value: 1, unitType: "PowerSegment", unitKnown: true, unitUnknown: false, unitConfidence: "high", sourcePath: "private/power/path" },
          { direction: "generation", resource: "LifeSupport", value: 0.5, unitType: "StandardResource", unitKnown: true, unitUnknown: false, unitConfidence: "high", sourcePath: "private/life/path" },
        ],
      }],
    }],
    thermalHeatGeneration: { resource: "Power", baselineTemperatureChange: 0.8, unitKnown: false, unitUnknown: true, sourcePath: "private/thermal/path" },
    confidence: "high",
  }];
  records["batteries.json"] = [{
    entityClass: batteryId,
    componentKey: batteryId,
    name: "Test Battery",
    displayName: "Test Battery",
    componentType: "battery",
    stateResourceDeltas: [{ stateName: "Online", deltas: [{
      deltaNode: "ItemResourceDeltaStorage",
      minimumConsumptionFraction: null,
      noOverGeneration: null,
      storageDischarge: 0,
      resources: [
        { direction: "consumption", resource: "Power", value: 2, unitType: "PowerSegment", unitKnown: true, unitUnknown: false, unitConfidence: "high" },
        { direction: "generation", resource: "Power", value: 2, unitType: "PowerSegment", unitKnown: true, unitUnknown: false, unitConfidence: "high" },
      ],
    }] }],
    confidence: "high",
  }];
  records["emps.json"] = [{
    entityClass: empId,
    componentKey: empId,
    name: "Test EMP",
    displayName: "Test EMP",
    componentType: "emp",
    emp: { chargeTime: { value: 26, unit: null, unitKnown: false, unitUnknown: true, sourcePath: "private/emp/path", attribute: "chargeTime" } },
    confidence: "high",
  }];
  records["quantum_interdiction_generators.json"] = [{
    entityClass: quantumInterdictionId,
    componentKey: quantumInterdictionId,
    name: "Test Quantum Interdiction Generator",
    displayName: "Test Quantum Interdiction Generator",
    componentType: "quantum_interdiction_generator",
    quantumInterdiction: {
      generator: { basePowerDrawFraction: { value: 0.2, unit: "fraction", unitKnown: true, unitUnknown: false, sourcePath: "private/generator/path" } },
      jammer: { jammerRange: { value: 5000, unit: null, unitKnown: false, unitUnknown: true, sourcePath: "private/jammer/path" } },
      pulse: { chargeTimeSecs: { value: 90, unit: "seconds", unitKnown: true, unitUnknown: false, sourcePath: "private/pulse/path" } },
    },
    confidence: "high",
  }];
  records["fuel_tanks.json"] = [{
    entityClass: fuelTankId,
    componentKey: fuelTankId,
    name: "Test Hydrogen Tank",
    displayName: "Test Hydrogen Tank",
    componentType: "fuel_tank",
    itemType: "FuelTank",
    stateResourceDeltas: [{ stateName: "Online", deltas: [{
      deltaNode: "ItemResourceDeltaStorage",
      storageDischarge: 0,
      resources: [
        { direction: "consumption", resource: "Fuel", value: 10, unitType: "StandardResource", unitKnown: true, unitUnknown: false, unitConfidence: "high", sourcePath: "private/fuel/consumption" },
        { direction: "generation", resource: "Fuel", value: 10, unitType: "StandardResource", unitKnown: true, unitUnknown: false, unitConfidence: "high", sourcePath: "private/fuel/generation" },
      ],
    }] }],
    fuelTankParams: {
      hydrogenMaxFlowMultiplier: { value: 1, unit: null, unitKnown: false, unitUnknown: true, sourcePath: "private/tank/params" },
    },
    resourceContainerCapacity: { value: 0.8, unitNode: "SStandardCargoUnit", unitField: "standardCargoUnits", unitKnown: false, unitUnknown: true, sourcePath: "private/tank/capacity" },
    inclusiveResources: [{ reference: "de9f4d03-6b60-429d-9b26-9f2308bae973", sourcePath: "private/tank/resource" }],
    defaultComposition: [{ entry: "de9f4d03-6b60-429d-9b26-9f2308bae973", weight: 1, sourcePath: "private/tank/composition" }],
    confidence: "high",
  }];
  records["fuel_intakes.json"] = [{
    entityClass: fuelIntakeId,
    componentKey: fuelIntakeId,
    name: "Test Fuel Intake",
    displayName: "Test Fuel Intake",
    componentType: "fuel_intake",
    fuelIntakeParams: {
      fuelPushRate: { value: 50, unit: null, unitKnown: false, unitUnknown: true, sourcePath: "private/intake/rate" },
      minimumRate: { value: 0.2, unit: null, unitKnown: false, unitUnknown: true, sourcePath: "private/intake/minimum" },
    },
    confidence: "high",
  }];
  records["personal_storage.json"] = [{
    entityClass: personalStorageId,
    componentKey: personalStorageId,
    name: "Test Personal Storage",
    displayName: "Test Personal Storage",
    componentType: "personal_storage",
    inventoryContainer: { containerParamsRef: "c5efc6cb-bbed-4e9c-a42b-623b30417ab0", canAutoStoreRestrictedItems: false, sourcePath: "private/storage/container" },
    inventoryCapacity: { value: 343, unitNode: "SCentiCargoUnit", unitField: "centiSCU", unitKnown: false, unitUnknown: true, sourcePath: "private/storage/capacity" },
    internalPorts: [{
      name: "IP_Button",
      displayName: "@LOC_EMPTY",
      minSize: 0,
      maxSize: 1,
      acceptedTypes: [{ type: "ControlPanel", subTypes: ["DoorPart"], sourcePath: "private/storage/accepted" }],
      sourcePath: "private/storage/port",
    }],
    confidence: "high",
  }];
  records["mining_modifiers.json"] = [{
    entityClass: miningModifierId,
    componentKey: miningModifierId,
    name: "Test Mining Module",
    displayName: "Test Mining Module",
    componentType: "mining_modifier",
    durationSeconds: 60,
    shatterDamageModifier: -30,
    instabilityModifier: 0.8,
    resistanceModifier: 15.5,
    fractureWindowSizeModifier: 1.2,
    optimalChargeRateModifier: 1.25,
    catastrophicChargeRateModifier: 0.75,
    isOptimalRateGood: 1,
    sourceFile: "private/mining/module.xml",
    confidence: "high",
  }];
  records["thrusters.json"] = [{
    entityClass: thrusterId,
    componentKey: thrusterId,
    name: "Test VTOL Thruster",
    displayName: "Test VTOL Thruster",
    componentType: "thruster",
    thrustCapacity: 100,
    onlyActiveInVtol: true,
    onlyActiveInVtolProvenance: { sourcePath: "private/thruster/path", attribute: "onlyActiveInVTOL", confidence: "high" },
    confidence: "high",
  }, {
    entityClass: legacyVtolThrusterId,
    componentKey: legacyVtolThrusterId,
    name: "Legacy VTOL Thruster",
    displayName: "Legacy VTOL Thruster",
    componentType: "thruster",
    vtol: "true",
    confidence: "high",
  }, {
    entityClass: legacyNonVtolThrusterId,
    componentKey: legacyNonVtolThrusterId,
    name: "Legacy Non-VTOL Thruster",
    displayName: "Legacy Non-VTOL Thruster",
    componentType: "thruster",
    vtol: "false",
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

test("preserves zero when resolving legacy quantum fuel aliases", () => {
  assert.deepEqual(componentStats({ fuelRate: 0 }), {
    quantumFuelRequirement: 0,
    fuelRate: 0,
  });
});

test("older datasets remain readable when additive ordnance registries are absent", async () => {
  const root = await fixtureRoot();
  const fittingRoot = path.join(root, "LIVE", "test-build");
  try {
    await unlink(path.join(fittingRoot, "missiles.json"));
    await unlink(path.join(fittingRoot, "missile_racks.json"));
    await unlink(path.join(fittingRoot, "bombs.json"));
    await unlink(path.join(fittingRoot, "bomb_racks.json"));
    await unlink(path.join(fittingRoot, "missile_controllers.json"));
    await unlink(path.join(fittingRoot, "relays.json"));
    await unlink(path.join(fittingRoot, "life_support.json"));
    await unlink(path.join(fittingRoot, "batteries.json"));
    await unlink(path.join(fittingRoot, "emps.json"));
    await unlink(path.join(fittingRoot, "quantum_interdiction_generators.json"));
    await unlink(path.join(fittingRoot, "fuel_tanks.json"));
    await unlink(path.join(fittingRoot, "fuel_intakes.json"));
    await unlink(path.join(fittingRoot, "personal_storage.json"));
    await unlink(path.join(fittingRoot, "mining_modifiers.json"));
    const meta = await handleFittingRoute("GET", "/api/v1/fitting/meta?channel=LIVE&buildId=test-build", "test-request", root);
    const components = await handleFittingRoute("GET", "/api/v1/fitting/components?channel=LIVE&buildId=test-build", "test-request", root);
    assert.equal(meta?.status, 200, JSON.stringify(meta?.body));
    assert.equal(components?.status, 200, JSON.stringify(components?.body));
    assert.equal(JSON.stringify(meta?.body).includes("missiles"), false);
    assert.equal(JSON.stringify(meta?.body).includes("bombs"), false);
    assert.equal(JSON.stringify(meta?.body).includes("missile_controllers"), false);
    assert.equal(JSON.stringify(meta?.body).includes("life_support"), false);
    assert.equal(JSON.stringify(meta?.body).includes("quantum_interdiction_generators"), false);
    assert.equal(JSON.stringify(meta?.body).includes("fuel_tanks"), false);
    assert.equal(JSON.stringify(meta?.body).includes("personal_storage"), false);
    assert.equal(JSON.stringify(meta?.body).includes("mining_modifiers"), false);
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
    assert.equal((ship?.body as { data: { performance: { boostRegenDelayAfterUse: number | null } } }).data.performance.boostRegenDelayAfterUse, 0.2);
    assert.equal(JSON.stringify(ship?.body).includes("sourceFile"), false);
    assert.equal(JSON.stringify(ship?.body).includes(root), false);

    const shield = await handleFittingRoute("GET", `/api/v1/fitting/components/22222222-2222-4222-8222-222222222222?${query}`, "test-request", root);
    assert.equal((shield?.body as { data: { mitigation: { kind: string; resistanceByDamageType: { physical: { max: number } } } } }).data.mitigation.kind, "shield");
    assert.equal((shield?.body as { data: { mitigation: { resistanceByDamageType: { physical: { max: number } } } } }).data.mitigation.resistanceByDamageType.physical.max, 0.25);
    assert.equal(JSON.stringify(shield?.body).includes("sourceFile"), false);

    const cooler = await handleFittingRoute("GET", `/api/v1/fitting/components/${componentId}?${query}`, "test-request", root);
    const coolerStats = (cooler?.body as { data: { stats: Record<string, number> } }).data.stats;
    assert.equal(coolerStats.powerInputMaximum, 1);
    assert.equal(coolerStats.powerInputMinimum, 0.5);
    assert.equal(coolerStats.minimumPowerRequired, 0.5);
    assert.equal(coolerStats.maximumPowerRequiredPips, 2);
    assert.equal(coolerStats.powerInputMinimumFraction, 0.5);
    assert.equal(coolerStats.coolingCapacity, 20);
    assert.equal(coolerStats.transferRate, 3);
    assert.equal(coolerStats.emSignatureDecayRate, 0.15);
    assert.equal(coolerStats.selfRepairTime, 25.5);
    assert.equal(coolerStats.selfRepairBaselineHp, 28);
    assert.equal(coolerStats.thermalEqualizationRate, 3.75);
    const coolerData = (cooler?.body as {
      data: {
        cooler: {
          coolingGeneratedByPowerPip: Array<Record<string, unknown>>;
          coolingGeneratedPowerFormula: string;
          coolingGeneratedPowerFormulaConfidence: string;
        };
      };
    }).data.cooler;
    assert.equal(coolerData.coolingGeneratedByPowerPip[0]?.value, 10);
    assert.equal("privateSourcePath" in (coolerData.coolingGeneratedByPowerPip[0] ?? {}), false);
    assert.equal(coolerData.coolingGeneratedPowerFormula, "maximumOutput * allocation");
    assert.equal(coolerData.coolingGeneratedPowerFormulaConfidence, "source_backed_for_coolers");

    const powerPlant = await handleFittingRoute("GET", `/api/v1/fitting/components/${powerPlantId}?${query}`, "test-request", root);
    const powerPlantStats = (powerPlant?.body as { data: { stats: Record<string, number> } }).data.stats;
    assert.equal(powerPlantStats.powerOutput, 12);
    assert.equal(powerPlantStats.powerCapacity, 20);
    assert.equal(powerPlantStats.powerGenerationRate, 11);

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

    const controller = await handleFittingRoute("GET", `/api/v1/fitting/components/${missileControllerId}?${query}`, "test-request", root);
    const controllerData = (controller?.body as {
      data: {
        type: string;
        selectionEligible: boolean;
        referenceStatus: string;
        stats: { lockAngleAtMin: number; lockAngleAtMax: number; maxArmedMissiles: number; launchCooldownTime: number };
      };
    }).data;
    assert.equal(controllerData.type, "missile_controller");
    assert.equal(controllerData.selectionEligible, false);
    assert.equal(controllerData.referenceStatus, "referenced_internal");
    assert.deepEqual(controllerData.stats, {
      lockAngleAtMin: 18,
      lockAngleAtMax: 18,
      maxArmedMissiles: 4,
      launchCooldownTime: 4,
    });

    const quantum = await handleFittingRoute("GET", `/api/v1/fitting/components/${quantumDriveId}?${query}`, "test-request", root);
    const quantumStats = (quantum?.body as { data: { stats: Record<string, number | null> } }).data.stats;
    assert.equal(quantumStats.quantumFuelRequirement, 0);
    assert.equal(quantumStats.fuelRate, 0);
    assert.equal(quantumStats.calibrationDelayInSeconds, 1.5);
    assert.equal(quantumStats.calibrationRate, 1000);
    assert.equal(quantumStats.calibrationTime, 11.5);
    assert.equal(quantumStats.minCalibrationRequirement, 5000);
    assert.equal(quantumStats.maxCalibrationRequirement, 10000);
    assert.equal(quantumStats.quantumStageOneAccelRate, 376000);
    assert.equal(quantumStats.quantumStageTwoAccelRate, 11200000);
    assert.equal(quantumStats.rangeEfficiency, 0.8);
    assert.equal(quantumStats.splineCooldown, 8);
    assert.equal(quantumStats.calibrationWarningAngleLimit, 30);
    assert.equal(quantumStats.travellingEmSignature, 14);
    assert.equal(quantumStats.interdictionEffectTime, 5);

    const radar = await handleFittingRoute("GET", `/api/v1/fitting/components/${radarId}?${query}`, "test-request", root);
    const radarStats = (radar?.body as { data: { stats: Record<string, number> } }).data.stats;
    assert.equal(radarStats.aimAssistMinAssignmentDistance, 100);
    assert.equal(radarStats.aimAssistOutsideRangeBufferDistance, 25);

    const lifeSupport = await handleFittingRoute("GET", `/api/v1/fitting/components/${lifeSupportId}?${query}`, "test-request", root);
    const lifeEngineering = (lifeSupport?.body as { data: { engineering: {
      stateResources: Array<{ stateName: string; deltas: Array<{ resources: Array<{ direction: string; resource: string; value: number }> }> }>;
      thermalHeatGeneration: { baselineTemperatureChange: number; unitUnknown: boolean };
    } } }).data.engineering;
    assert.equal(lifeEngineering.stateResources[0]?.stateName, "Online");
    assert.deepEqual(
      lifeEngineering.stateResources[0]?.deltas[0]?.resources.map(({ direction, resource, value }) => ({ direction, resource, value })),
      [
        { direction: "consumption", resource: "Power", value: 1 },
        { direction: "generation", resource: "LifeSupport", value: 0.5 },
      ],
    );
    assert.equal(lifeEngineering.thermalHeatGeneration.baselineTemperatureChange, 0.8);
    assert.equal(lifeEngineering.thermalHeatGeneration.unitUnknown, true);
    assert.equal(JSON.stringify(lifeSupport?.body).includes("sourcePath"), false);

    const battery = await handleFittingRoute("GET", `/api/v1/fitting/components/${batteryId}?${query}`, "test-request", root);
    const batteryDelta = (battery?.body as { data: { engineering: { stateResources: Array<{ deltas: Array<{ storageDischarge: number; resources: Array<{ direction: string }> }> }> } } }).data.engineering.stateResources[0]?.deltas[0];
    assert.equal(batteryDelta?.storageDischarge, 0);
    assert.deepEqual(batteryDelta?.resources.map(({ direction }) => direction), ["consumption", "generation"]);

    const relay = await handleFittingRoute("GET", `/api/v1/fitting/components/${relayId}?${query}`, "test-request", root);
    assert.equal((relay?.body as { data: { engineering: { relay: { isRelay: boolean; defaultPriority: number } } } }).data.engineering.relay.isRelay, true);
    assert.equal((relay?.body as { data: { engineering: { relay: { defaultPriority: number } } } }).data.engineering.relay.defaultPriority, 50);

    const emp = await handleFittingRoute("GET", `/api/v1/fitting/components/${empId}?${query}`, "test-request", root);
    assert.equal((emp?.body as { data: { engineering: { emp: { chargeTime: { value: number; unitUnknown: boolean } } } } }).data.engineering.emp.chargeTime.value, 26);
    assert.equal((emp?.body as { data: { engineering: { emp: { chargeTime: { unitUnknown: boolean } } } } }).data.engineering.emp.chargeTime.unitUnknown, true);

    const quantumInterdiction = await handleFittingRoute("GET", `/api/v1/fitting/components/${quantumInterdictionId}?${query}`, "test-request", root);
    const quantumEngineering = (quantumInterdiction?.body as { data: { engineering: { quantumInterdiction: {
      generator: { basePowerDrawFraction: { value: number; unit: string } };
      jammer: { jammerRange: { value: number; unitUnknown: boolean } };
      pulse: { chargeTimeSecs: { value: number; unit: string } };
    } } } }).data.engineering.quantumInterdiction;
    assert.equal(quantumEngineering.generator.basePowerDrawFraction.unit, "fraction");
    assert.equal(quantumEngineering.jammer.jammerRange.unitUnknown, true);
    assert.equal(quantumEngineering.pulse.chargeTimeSecs.value, 90);

    const fuelTank = await handleFittingRoute("GET", `/api/v1/fitting/components/${fuelTankId}?${query}`, "test-request", root);
    const fuelTankEngineering = (fuelTank?.body as { data: { engineering: {
      fuelTank: {
        params: { hydrogenMaxFlowMultiplier: { value: number; unitUnknown: boolean } };
        capacity: { value: number; unitNode: string; unitField: string; unitUnknown: boolean };
        inclusiveResources: Array<{ reference: string }>;
        defaultComposition: Array<{ entry: string; weight: number }>;
      };
    } } }).data.engineering.fuelTank;
    assert.equal(fuelTankEngineering.params.hydrogenMaxFlowMultiplier.value, 1);
    assert.equal(fuelTankEngineering.params.hydrogenMaxFlowMultiplier.unitUnknown, true);
    assert.deepEqual(fuelTankEngineering.capacity, {
      value: 0.8,
      unitNode: "SStandardCargoUnit",
      unitField: "standardCargoUnits",
      unitKnown: false,
      unitUnknown: true,
    });
    assert.equal(fuelTankEngineering.inclusiveResources[0]?.reference, "de9f4d03-6b60-429d-9b26-9f2308bae973");
    assert.equal(fuelTankEngineering.defaultComposition[0]?.weight, 1);

    const fuelIntake = await handleFittingRoute("GET", `/api/v1/fitting/components/${fuelIntakeId}?${query}`, "test-request", root);
    const fuelIntakeEngineering = (fuelIntake?.body as { data: { engineering: { fuelIntake: {
      fuelPushRate: { value: number; unitUnknown: boolean };
      minimumRate: { value: number; unitUnknown: boolean };
    } } } }).data.engineering.fuelIntake;
    assert.equal(fuelIntakeEngineering.fuelPushRate.value, 50);
    assert.equal(fuelIntakeEngineering.minimumRate.unitUnknown, true);

    const personalStorage = await handleFittingRoute("GET", `/api/v1/fitting/components/${personalStorageId}?${query}`, "test-request", root);
    const personalStorageEngineering = (personalStorage?.body as { data: { engineering: { personalStorage: {
      inventoryContainer: { containerParamsRef: string; canAutoStoreRestrictedItems: boolean };
      capacity: { value: number; unitNode: string; unitUnknown: boolean };
      internalPorts: Array<{ name: string; acceptedTypes: Array<{ type: string; subTypes: string[] }> }>;
    } } } }).data.engineering.personalStorage;
    assert.equal(personalStorageEngineering.inventoryContainer.canAutoStoreRestrictedItems, false);
    assert.equal(personalStorageEngineering.capacity.value, 343);
    assert.equal(personalStorageEngineering.capacity.unitNode, "SCentiCargoUnit");
    assert.deepEqual(personalStorageEngineering.internalPorts[0]?.acceptedTypes[0]?.subTypes, ["DoorPart"]);
    assert.equal(JSON.stringify(fuelTank?.body).includes("sourcePath"), false);
    assert.equal(JSON.stringify(personalStorage?.body).includes("private/storage"), false);

    const miningModifier = await handleFittingRoute("GET", `/api/v1/fitting/components/${miningModifierId}?${query}`, "test-request", root);
    const miningModifierData = (miningModifier?.body as { data: { type: string; stats: Record<string, number> } }).data;
    assert.equal(miningModifierData.type, "mining_modifier");
    assert.equal(miningModifierData.stats.durationSeconds, 60);
    assert.equal(miningModifierData.stats.shatterDamageModifier, -30);
    assert.equal(miningModifierData.stats.fractureWindowSizeModifier, 1.2);
    assert.equal(miningModifierData.stats.isOptimalRateGood, 1);
    assert.equal(JSON.stringify(miningModifier?.body).includes("sourceFile"), false);

    const miningModifierList = await handleFittingRoute("GET", `/api/v1/fitting/components?type=mining_modifier&${query}`, "test-request", root);
    assert.equal((miningModifierList?.body as { data: Array<{ id: string; type: string }> }).data[0]?.id, miningModifierId);

    const thruster = await handleFittingRoute("GET", `/api/v1/fitting/components/${thrusterId}?${query}`, "test-request", root);
    assert.equal((thruster?.body as { data: { thruster: { onlyActiveInVtol: boolean | null } } }).data.thruster.onlyActiveInVtol, true);
    assert.equal(JSON.stringify(thruster?.body).includes("onlyActiveInVtolProvenance"), false);
    assert.equal(JSON.stringify(thruster?.body).includes("private/thruster"), false);
    const legacyVtolThruster = await handleFittingRoute("GET", `/api/v1/fitting/components/${legacyVtolThrusterId}?${query}`, "test-request", root);
    const legacyNonVtolThruster = await handleFittingRoute("GET", `/api/v1/fitting/components/${legacyNonVtolThrusterId}?${query}`, "test-request", root);
    assert.equal((legacyVtolThruster?.body as { data: { thruster: { onlyActiveInVtol: boolean | null } } }).data.thruster.onlyActiveInVtol, true);
    assert.equal((legacyNonVtolThruster?.body as { data: { thruster: { onlyActiveInVtol: boolean | null } } }).data.thruster.onlyActiveInVtol, false);

    const fuelTankCalculated = await handleFittingRoute("POST", `/api/v1/fitting/calculate?${query}`, "test-request", root, {
      shipId,
      loadout: { "fuel/main": fuelTankId },
      options: { compareToStock: false },
    });
    assert.equal(fuelTankCalculated?.status, 200);
    assert.equal(
      (fuelTankCalculated?.body as { data: { componentCountsByType: Record<string, number> } }).data.componentCountsByType.fuel_tank,
      1,
    );

    const lifeSupportList = await handleFittingRoute("GET", `/api/v1/fitting/components?type=life_support&${query}`, "test-request", root);
    assert.equal((lifeSupportList?.body as { data: Array<{ id: string; type: string }> }).data[0]?.id, lifeSupportId);
    assert.equal((lifeSupportList?.body as { data: Array<{ type: string }> }).data[0]?.type, "life_support");

    const shieldData = (shield?.body as {
      data: {
        mitigation: {
          damagedRegenDelay: number;
          downedRegenDelay: number;
          regenByPowerPip: Array<{ pips: number; value: number }>;
        };
      };
    }).data.mitigation;
    const shieldStats = (shield?.body as { data: { stats: Record<string, number> } }).data.stats;
    assert.equal(shieldStats.hardeningFactor, 0.2);
    assert.equal(shieldStats.reservePoolRegenRate, 2);
    assert.equal(shieldStats.reservePoolRegenTime, 8);
    assert.equal(shieldData.damagedRegenDelay, 4);
    assert.equal(shieldData.downedRegenDelay, 8);
    assert.deepEqual(shieldData.regenByPowerPip.map(({ pips, value }) => ({ pips, value })), [
      { pips: 1, value: 5 },
      { pips: 2, value: 12 },
    ]);

    const compatibleMissiles = await handleFittingRoute(
      "GET",
      `/api/v1/fitting/ships/${shipId}/ports/missile%2Fmain/compatible-components?${query}`,
      "test-request",
      root,
    );
    assert.deepEqual(
      (compatibleMissiles?.body as { data: { components: Array<{ id: string }> } }).data.components.map((item) => item.id),
      [missileId],
    );
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

    const ineligibleValidation = await handleFittingRoute("POST", "/api/v1/fitting/validate?channel=LIVE&buildId=test-build", "test-request", root, {
      shipId,
      loadout: { "missile/main": templateMissileId },
    });
    const ineligibleValidationData = (ineligibleValidation?.body as {
      data: { valid: boolean; mismatchReasons: Array<{ kind: string }> };
    }).data;
    assert.equal(ineligibleValidationData.valid, false);
    assert.ok(ineligibleValidationData.mismatchReasons.some((reason) => reason.kind === "selection_ineligible"));

    const ineligibleCalculation = await handleFittingRoute("POST", "/api/v1/fitting/calculate?channel=LIVE&buildId=test-build", "test-request", root, {
      shipId,
      loadout: { "missile/main": templateMissileId },
      options: { compareToStock: false },
    });
    const ineligibleCalculationData = (ineligibleCalculation?.body as {
      data: { componentCountsByType: Record<string, number>; unresolvedReferences: Array<{ kind: string }> };
    }).data;
    assert.deepEqual(ineligibleCalculationData.componentCountsByType, {});
    assert.ok(ineligibleCalculationData.unresolvedReferences.some((reference) => reference.kind === "selection_ineligible"));

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

    const lifeSupportSimulated = await handleFittingRoute("POST", "/api/v1/fitting/calculate?channel=LIVE&buildId=test-build", "test-request", root, {
      shipId,
      loadout: {
        "power/main": powerPlantId,
        "life_support/main": lifeSupportId,
      },
      options: { compareToStock: false },
      simulation: {
        modelVersion: "fitting-simulation-v1",
        durationSeconds: 60,
        powerAllocation: { weapons: 0, engines: 0, quantum: 0, radar: 0, shields: 0, lifeSupport: 1, cooler1: 0, cooler2: 0 },
      },
    });
    assert.equal(lifeSupportSimulated?.status, 200);
    const lifeSupportSimulation = (lifeSupportSimulated?.body as {
      data: { simulation: { power: { allocatedSegments: { value: number | null } }; missingInputs: Array<{ componentId: string; path: string }> } };
    }).data.simulation;
    assert.equal(lifeSupportSimulation.power.allocatedSegments.value, null);
    assert.ok(lifeSupportSimulation.missingInputs.some(
      (entry) => entry.componentId === lifeSupportId && entry.path === "powerCategory",
    ));

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
    assert.equal(data.stats.maxAmmoLoad, 10);
    assert.equal(data.stats.maxRegenPerSec, 2);
    assert.equal(data.stats.regenerationCooldown, 1);
    assert.equal(data.stats.burstShotCount, 4);
    assert.equal(data.stats.penetrationNearRadius, 0);
    assert.equal(data.stats.penetrationFarRadius, 5);
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
