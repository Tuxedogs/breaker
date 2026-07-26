import { createHash } from "node:crypto";
import type { ApiMeta, Confidence, DatasetSelection } from "./fitting.types.js";
import { FittingHttpError } from "./fitting.types.js";
import { loadRegistry, OPTIONAL_PUBLIC_REGISTRIES, PUBLIC_REGISTRIES, readRegistryHeader } from "./registryStore.js";

type Row = Record<string, unknown>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COMPONENT_FILES = [
  ["ship_weapons.json", "ship_weapon"],
  ["missiles.json", "missile"],
  ["missile_racks.json", "missile_rack"],
  ["bombs.json", "bomb"],
  ["bomb_racks.json", "bomb_rack"],
  ["missile_controllers.json", "missile_controller"],
  ["mining_lasers.json", "mining_laser"],
  ["salvage_heads.json", "salvage_head"],
  ["salvage_modifiers.json", "salvage_modifier"],
  ["fuel_nozzles.json", "fuel_nozzle"],
  ["shields.json", "shield"],
  ["ship_armors.json", "armor"],
  ["power_plants.json", "power_plant"],
  ["coolers.json", "cooler"],
  ["quantum_drives.json", "quantum_drive"],
  ["radars.json", "radar"],
  ["thrusters.json", "thruster"],
] as const;

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function nullableBooleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function arrayValue(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function powerCurvePoints(value: unknown): Array<Record<string, number | string | null>> | null {
  const points = arrayValue(value);
  if (points === null) return null;
  return points.flatMap((raw) => {
    const point = objectValue(raw);
    if (!point) return [];
    return [{
      pips: numberValue(point.pips),
      percentAssigned: numberValue(point.percentAssigned),
      modifier: numberValue(point.modifier),
      range: text(point.range),
      value: numberValue(point.value),
    }];
  });
}

function isDatasetUnavailable(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "DATASET_UNAVAILABLE";
}

function publicLabel(value: unknown): string | null {
  const valueText = text(value);
  return valueText && !canonicalId(valueText) ? valueText : null;
}

function confidence(value: unknown): Confidence {
  return value === "high" || value === "medium" ? value : "low";
}

export function canonicalId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replaceAll("_", "-");
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

function requiredId(value: unknown, resource: string): string {
  const id = canonicalId(value);
  if (!id) throw new FittingHttpError(409, "DATASET_SCHEMA_UNSUPPORTED", "Dataset schema unsupported", `${resource} has no stable UUID identifier.`);
  return id;
}

function requestedId(value: string, resource: string): string {
  const id = canonicalId(value);
  if (!id) {
    throw new FittingHttpError(400, "INVALID_REQUEST", "Invalid request", `${resource} identifier must be a UUID.`, [
      { path: `path.${resource}Id`, code: "INVALID_VALUE", message: "Expected a canonical or underscore UUID." },
    ]);
  }
  return id;
}

export async function fittingApiMeta(selection: DatasetSelection): Promise<ApiMeta> {
  const header = await readRegistryHeader(selection, "ships.json");
  if (header.schemaVersion !== 1) {
    throw new FittingHttpError(409, "DATASET_SCHEMA_UNSUPPORTED", "Dataset schema unsupported", `Artifact schema ${header.schemaVersion} is not supported by fitting API v1.`);
  }
  return {
    apiVersion: "1",
    artifactSchemaVersion: header.schemaVersion,
    channel: selection.channel,
    buildId: selection.buildId,
    generatedAt: header.generatedAt ?? new Date(0).toISOString(),
  };
}

function diagnostics(row: Row): Record<string, unknown> {
  const warnings = Array.isArray(row.taxonomyWarnings)
    ? row.taxonomyWarnings.filter((value): value is string => typeof value === "string")
    : [];
  const unresolved = Array.isArray(row.unresolvedRefs) ? row.unresolvedRefs : [];
  return {
    warnings,
    unresolvedCount: unresolved.length,
    sourceKeys: {
      entityClass: text(row.entityClass),
      shipKey: text(row.shipKey),
      componentKey: text(row.componentKey),
      ammoKey: text(row.ammoKey),
    },
  };
}

function includeDiagnostics(search: URLSearchParams): boolean {
  const include = search.get("include");
  if (include === null) return false;
  if (include !== "diagnostics") {
    throw new FittingHttpError(400, "INVALID_REQUEST", "Invalid request", "include must be diagnostics.");
  }
  return true;
}

function shipSummary(row: Row): Record<string, unknown> {
  return {
    id: requiredId(row.entityClass ?? row.shipKey, "Ship"),
    name: text(row.name) ?? text(row.recordName) ?? "Unknown",
    displayName: text(row.displayName) ?? text(row.name) ?? text(row.recordName) ?? "Unknown",
    manufacturer: publicLabel(row.manufacturer),
    vehicleType: text(row.vehicleType) ?? "unknown",
    isGroundVehicle: booleanValue(row.isGroundVehicle),
    career: text(row.career),
    role: text(row.role),
    crew: { min: numberValue(row.crewMin), max: numberValue(row.crewMax) },
    cargoCapacityScu: numberValue(row.cargoCapacitySCU),
    confidence: confidence(row.confidence),
  };
}

export function componentType(row: Row, fallback: string): string {
  const raw = (text(row.componentType) ?? fallback).toLowerCase();
  const aliases: Record<string, string> = {
    ship_weapon: "ship_weapon",
    weapon: "ship_weapon",
    missile: "missile",
    missile_rack: "missile_rack",
    missilerack: "missile_rack",
    bomb: "bomb",
    bomb_rack: "bomb_rack",
    bombrack: "bomb_rack",
    missile_controller: "missile_controller",
    missilecontroller: "missile_controller",
    shield: "shield",
    armor: "armor",
    power_plant: "power_plant",
    cooler: "cooler",
    quantum_drive: "quantum_drive",
    radar: "radar",
    thruster: "thruster",
    mining_laser: "mining_laser",
    weaponmining: "mining_laser",
    salvage_head: "salvage_head",
    salvagehead: "salvage_head",
    salvage_modifier: "salvage_modifier",
    salvagemodifier: "salvage_modifier",
    fuel_nozzle: "fuel_nozzle",
  };
  return aliases[raw] ?? "other";
}

export function componentSummary(row: Row, fallbackType = "other"): Record<string, unknown> {
  return {
    id: requiredId(row.entityClass ?? row.componentKey ?? row.thrusterKey, "Component"),
    name: text(row.name) ?? "Unknown",
    displayName: text(row.displayName) ?? text(row.name) ?? "Unknown",
    manufacturer: publicLabel(row.manufacturer),
    type: componentType(row, fallbackType),
    subtype: text(row.componentSubType ?? row.subtype ?? row.thrusterType),
    size: numberValue(row.size ?? row.attachSize),
    grade: text(row.grade),
    class: text(row.class),
    confidence: confidence(row.confidence),
    selectionEligible: nullableBooleanValue(row.selectionEligible),
    referenceStatus: text(row.referenceStatus),
  };
}

export function componentStats(row: Row): Record<string, number | null> {
  const mapping: Record<string, string> = {
    mass: "mass",
    volume: "volume",
    health: "health",
    powerDraw: "powerDraw",
    coolantUsage: "coolantUsage",
    coolingDraw: "coolingDraw",
    coolingRequired: "coolingRequired",
    heatGenerated: "heatGenerated",
    infraredEmission: "infraredEmission",
    electromagneticEmission: "electromagneticEmission",
    alphaDamage: "alphaDamageTotal",
    explosionRadiusMin: "explosionRadiusMin",
    explosionRadiusMax: "explosionRadiusMax",
    maxLifetime: "maxLifetime",
    armTime: "armTime",
    igniteTime: "igniteTime",
    collisionDelayTime: "collisionDelayTime",
    explosionSafetyDistance: "explosionSafetyDistance",
    projectileProximity: "projectileProximity",
    linearSpeed: "linearSpeed",
    boostPhaseDuration: "boostPhaseDuration",
    fuelTankSize: "fuelTankSize",
    trackingSignalMin: "trackingSignalMin",
    lockTime: "lockTime",
    lockingAngle: "lockingAngle",
    lockRangeMin: "lockRangeMin",
    lockRangeMax: "lockRangeMax",
    signalResilienceMin: "signalResilienceMin",
    signalResilienceMax: "signalResilienceMax",
    launchDelay: "launchDelay",
    missileSlotCount: "missileSlotCount",
    bombSlotCount: "bombSlotCount",
    ordnanceSlotCount: "ordnanceSlotCount",
    lockAngleAtMin: "lockAngleAtMin",
    lockAngleAtMax: "lockAngleAtMax",
    maxArmedMissiles: "maxArmedMissiles",
    launchCooldownTime: "launchCooldownTime",
    dragAreaRadius: "dragAreaRadius",
    centreOfPressureOffsetY: "centreOfPressureOffsetY",
    maximumDropAngleFromFlatFlight: "maximumDropAngleFromFlatFlight",
    dps: "dps",
    theoreticalDps: "theoreticalDps",
    damageOver60Seconds: "damageOver60Seconds",
    sustainedDps60: "sustainedDps60",
    projectileSpeed: "projectileSpeed",
    projectileLifetime: "projectileLifetime",
    calculatedRange: "calculatedRange",
    projectileMaxTravel: "projectileMaxTravel",
    ammoCapacity: "ammoCapacity",
    initialAmmoCount: "initialAmmoCount",
    maxAmmoCount: "maxAmmoCount",
    ammoCostPerShot: "ammoCostPerShot",
    requestedAmmoLoad: "requestedAmmoLoad",
    maxAmmoLoad: "maxAmmoLoad",
    regenerationCostPerBullet: "regenerationCostPerBullet",
    requestedRegenPerSec: "requestedRegenPerSec",
    maxRegenPerSec: "maxRegenPerSec",
    regenerationCooldown: "regenerationCooldown",
    shieldHp: "shieldHP",
    regenRate: "regenRate",
    powerGenerated: "powerGenerated",
    coolingGenerated: "coolingGenerated",
    quantumSpeed: "quantumSpeed",
    spoolTime: "spoolTime",
    quantumCooldown: "quantumCooldown",
    detectionRange: "detectionRange",
    scanRange: "scanRange",
    scanRate: "scanRate",
    scanCooldownTime: "scanCooldownTime",
    signatureSensitivity: "signatureSensitivity",
    thrustCapacity: "thrustCapacity",
    damageEnergy: "damageEnergy",
    damagePhysical: "damagePhysical",
    damageThermal: "damageThermal",
    damageDistortion: "damageDistortion",
    damageBiochemical: "damageBiochemical",
    damageStun: "damageStun",
    fireRateRpm: "fireRateRpm",
    burstShotCount: "burstCount",
    heatPerShot: "heatPerShot",
    heatCapacity: "heatCapacity",
    minimumTemperature: "minimumTemperature",
    overheatTemperature: "overheatTemperature",
    cooldownRate: "cooldownRate",
    coolingPerSecond: "coolingPerSecond",
    timeTillCoolingStarts: "timeTillCoolingStarts",
    overheatFixTime: "overheatFixTime",
    postOverheatTemperature: "postOverheatTemperature",
    spreadMin: "spreadMin",
    spreadMax: "spreadMax",
    spreadFirstAttack: "spreadFirstAttack",
    spreadPerAttack: "spreadPerAttack",
    spreadDecay: "spreadDecay",
    penetrationNearRadius: "nearRadius",
    penetrationFarRadius: "farRadius",
    powerUsage: "powerUsage",
    powerConsumptionNominal: "powerConsumptionNominal",
    minimumConsumptionFraction: "minimumConsumptionFraction",
    powerConsumptionMinimum: "powerConsumptionMinimum",
    powerInputMaximum: "powerInputMaximum",
    powerInputMinimum: "powerInputMinimum",
    powerInputMaximumPips: "powerInputMaximumPips",
    powerInputMinimumPips: "powerInputMinimumPips",
    maxPenetrationThickness: "maxPenetrationThickness",
    distortionResistance: "distortionResistance",
    crossSection: "crossSection",
    radarEmission: "radarEmission",
    emSignatureNominal: "emSignatureNominal",
    emSignatureDecayRate: "emSignatureDecayRate",
    repairRestoreRatio: "repairRestoreRatio",
    selfRepairMaxCount: "selfRepairMaxCount",
    selfRepairTime: "selfRepairTime",
    selfRepairHealthRatio: "selfRepairHealthRatio",
    selfRepairBaselineHp: "selfRepairBaselineHp",
    miningPower: "miningPower",
    extractionPower: "extractionPower",
    instabilityModifier: "instabilityModifier",
    resistanceModifier: "resistanceModifier",
    fractureWindowSize: "fractureWindowSize",
    optimalChargeRate: "optimalChargeRate",
    laserRange: "laserRange",
    beamRange: "beamRange",
    heatPerSecond: "heatPerSecond",
    wearPerSecond: "wearPerSecond",
    powerUsageMin: "powerUsageMin",
    powerUsageMax: "powerUsageMax",
    throttleMinimum: "throttleMinimum",
    hullScrapingSpeedMultiplier: "hullScrapingSpeedMultiplier",
    hullScrapingRadiusMultiplier: "hullScrapingRadiusMultiplier",
    hullScrapingEfficiencyMultiplier: "hullScrapingEfficiencyMultiplier",
    hullScrapingSpeedModifier: "hullScrapingSpeedModifier",
    hullScrapingRadiusModifier: "hullScrapingRadiusModifier",
    hullScrapingEfficiencyModifier: "hullScrapingEfficiencyModifier",
    materialEfficiency: "materialEfficiency",
    maxHealthRepairRate: "maxHealthRepairRate",
    maxDamageMapRepairRate: "maxDamageMapRepairRate",
    tractorMinForce: "tractorMinForce",
    tractorMaxForce: "tractorMaxForce",
    tractorMinDistance: "tractorMinDistance",
    tractorMaxDistance: "tractorMaxDistance",
    tractorFullStrengthDistance: "tractorFullStrengthDistance",
    tractorMaxVolume: "tractorMaxVolume",
    fuelTransferRate: "fuelTransferRate",
    quantumFuelTransferRate: "quantumFuelTransferRate",
    captureRadius: "captureRadius",
    distortionMaximum: "distortionMaximum",
    onlineEmSignature: "onlineEmSignature",
    onlineIrSignature: "onlineIrSignature",
    calibrationDelayInSeconds: "calibrationDelayInSeconds",
    calibrationRate: "calibrationRate",
    calibrationTime: "calibrationTime",
    minCalibrationRequirement: "minCalibrationRequirement",
    maxCalibrationRequirement: "maxCalibrationRequirement",
    quantumStageOneAccelRate: "quantumStageOneAccelRate",
    quantumStageTwoAccelRate: "quantumStageTwoAccelRate",
    thermalEqualizationRate: "thermalEqualizationRate",
  };
  const stats: Record<string, number | null> = {};
  for (const [publicName, sourceName] of Object.entries(mapping)) {
    if (sourceName in row) stats[publicName] = numberValue(row[sourceName]);
  }
  if ("quantumFuelRequirement" in row || "fuelRate" in row) {
    const quantumFuelRequirement = numberValue(row.quantumFuelRequirement) ?? numberValue(row.fuelRate);
    stats.quantumFuelRequirement = quantumFuelRequirement;
    stats.fuelRate = quantumFuelRequirement;
  }
  return stats;
}

function componentWeapon(row: Row, fallbackType: string): Record<string, unknown> | null {
  if (componentType(row, fallbackType) !== "ship_weapon") return null;
  const actions = (arrayValue(row.fireActions) ?? []).map((raw) => {
    const action = objectValue(raw) ?? {};
    return {
      kind: text(action.kind) ?? "unknown",
      name: text(action.name),
      actionIndex: numberValue(action.actionIndex),
      sourcePath: text(action.sourcePath),
      fireRateRpm: numberValue(action.fireRateRpm),
      heatPerShot: numberValue(action.heatPerShot),
      heatPerSecond: numberValue(action.heatPerSecond),
      ammoCost: numberValue(action.ammoCost),
      pelletCount: numberValue(action.pelletCount),
      damageMultiplier: numberValue(action.damageMultiplier),
      spreadMin: numberValue(action.spreadMin),
      spreadMax: numberValue(action.spreadMax),
      spreadFirstAttack: numberValue(action.spreadFirstAttack),
      spreadPerAttack: numberValue(action.spreadPerAttack),
      spreadDecay: numberValue(action.spreadDecay),
      chargeTime: numberValue(action.chargeTime),
      chargeUpTime: numberValue(action.chargeUpTime),
      chargeDownTime: numberValue(action.chargeDownTime),
      cooldownTime: numberValue(action.cooldownTime),
      spinUpTime: numberValue(action.spinUpTime),
      spinDownTime: numberValue(action.spinDownTime),
      fireDuringSpinUp: nullableBooleanValue(action.fireDuringSpinUp),
      fullDamageRange: numberValue(action.fullDamageRange),
      zeroDamageRange: numberValue(action.zeroDamageRange),
      damagePerSecondTotal: numberValue(action.damagePerSecondTotal),
    };
  });
  return {
    recordSchemaVersion: numberValue(row.recordSchemaVersion),
    actions,
    dpsModelVersion: text(row.dpsModelVersion),
    dpsAssumptions: (arrayValue(row.dpsAssumptions) ?? []).filter((value): value is string => typeof value === "string"),
    dpsConfidence: text(row.dpsConfidence),
    dpsPolicy: text(row.dpsPolicy),
  };
}

function componentOrdnance(row: Row, fallbackType: string): Record<string, unknown> | null {
  const type = componentType(row, fallbackType);
  if (type === "missile") {
    const requiresLauncher = numberValue(row.requiresLauncher);
    return {
      kind: "missile",
      ordnanceClass: text(row.ordnanceClass),
      trackingSignalType: text(row.trackingSignalType),
      requiresLauncher: requiresLauncher === null ? null : requiresLauncher === 1,
    };
  }
  if (type === "bomb") {
    const requiresLauncher = numberValue(row.requiresLauncher);
    return {
      kind: "bomb",
      ordnanceClass: text(row.ordnanceClass) ?? "Bomb",
      requiresLauncher: requiresLauncher === null ? null : requiresLauncher === 1,
    };
  }
  if (type === "missile_rack" || type === "bomb_rack") {
    const supportedSizes = type === "bomb_rack" ? row.supportedBombSizes : row.supportedMissileSizes;
    const rawPorts = type === "bomb_rack" ? row.bombPorts : row.missilePorts;
    return {
      kind: type,
      supportedOrdnanceSizes: (arrayValue(supportedSizes) ?? []).filter(
        (value): value is number => typeof value === "number" && Number.isFinite(value),
      ),
      ports: (arrayValue(rawPorts) ?? []).flatMap((raw) => {
        const port = objectValue(raw);
        if (!port) return [];
        return [{
          name: text(port.name),
          minSize: numberValue(port.minSize),
          maxSize: numberValue(port.maxSize),
        }];
      }),
    };
  }
  return null;
}

function shieldMitigation(row: Row): Record<string, unknown> {
  return {
    shieldHp: numberValue(row.shieldHP ?? row.maxShieldHealth),
    maxShieldHealth: numberValue(row.maxShieldHealth),
    maxShieldRegen: numberValue(row.maxShieldRegen),
    damagedRegenDelay: numberValue(row.damagedRegenDelay),
    downedRegenDelay: numberValue(row.downedRegenDelay),
    shieldFaceCount: numberValue(row.shieldFaceCount),
    resistanceByDamageType: objectValue(row.shieldResistanceByDamageType),
    absorptionByDamageType: objectValue(row.shieldAbsorptionByDamageType),
    regenByPowerPip: powerCurvePoints(row.shieldRegenByPowerPip),
    regenPowerFormula: text(row.shieldRegenPowerFormula),
    regenPowerFormulaConfidence: text(row.shieldRegenPowerFormulaConfidence),
  };
}

function componentCooler(row: Row, fallbackType: string): Record<string, unknown> | null {
  if (componentType(row, fallbackType) !== "cooler") return null;
  return {
    coolingGeneratedByPowerPip: powerCurvePoints(row.coolingGeneratedByPowerPip),
    coolingGeneratedPowerFormula: text(row.coolingGeneratedPowerFormula),
    coolingGeneratedPowerFormulaConfidence: text(row.coolingGeneratedPowerFormulaConfidence),
  };
}

function armorMitigation(row: Row): Record<string, unknown> {
  return {
    health: numberValue(row.health),
    basePenetrationReduction: numberValue(row.basePenetrationReduction),
    damageMultiplierByDamageType: objectValue(row.armorDamageMultiplierByDamageType),
    deflectionThresholdByDamageType: objectValue(row.armorDeflectionThresholdByDamageType),
    penetrationAbsorptionByDamageType: objectValue(row.armorPenetrationAbsorptionByDamageType),
    resistanceByDamageType: objectValue(row.armorResistanceByDamageType),
  };
}

function componentMitigation(row: Row, fallbackType: string): Record<string, unknown> | null {
  const type = componentType(row, fallbackType);
  if (type === "shield") return { kind: "shield", ...shieldMitigation(row) };
  if (type === "armor") return { kind: "armor", ...armorMitigation(row) };
  const penetrationParams = objectValue(row.penetrationParams);
  if (penetrationParams || "basePenetrationDistance" in row || "maxPenetrationThickness" in row || "ammoPenetration" in row) {
    return {
      kind: "weapon_projectile",
      damage: {
        physical: numberValue(row.damagePhysical),
        energy: numberValue(row.damageEnergy),
        distortion: numberValue(row.damageDistortion),
        thermal: numberValue(row.damageThermal),
        biochemical: numberValue(row.damageBiochemical),
        stun: numberValue(row.damageStun),
      },
      ammoPenetration: numberValue(row.ammoPenetration),
      basePenetrationDistance: numberValue(row.basePenetrationDistance),
      maxPenetrationThickness: numberValue(row.maxPenetrationThickness),
      penetrationParams,
    };
  }
  return null;
}

function shipMitigation(row: Row): Record<string, unknown> {
  return {
    hullHp: numberValue(row.hullHP),
    componentPenetrationDamageMultiplier: numberValue(row.componentPenetrationDamageMultiplier),
    componentPenetrationDamageMultiplierProvenance: objectValue(row.componentPenetrationDamageMultiplierProvenance),
    fusePenetrationDamageMultiplier: numberValue(row.fusePenetrationDamageMultiplier),
    fusePenetrationDamageMultiplierProvenance: objectValue(row.fusePenetrationDamageMultiplierProvenance),
  };
}

function ammoMitigation(row: Row): Record<string, unknown> {
  return {
    damage: {
      physical: numberValue(row.damagePhysical),
      energy: numberValue(row.damageEnergy),
      distortion: numberValue(row.damageDistortion),
      thermal: numberValue(row.damageThermal),
      biochemical: numberValue(row.damageBiochemical),
      stun: numberValue(row.damageStun),
    },
    ammoPenetration: numberValue(row.ammoPenetration),
    basePenetrationDistance: numberValue(row.basePenetrationDistance),
    maxPenetrationThickness: numberValue(row.maxPenetrationThickness),
    penetrationParams: objectValue(row.penetrationParams),
  };
}

function pagination(search: URLSearchParams, signatureInput: string): { limit: number; offset: number; signature: string } {
  const rawLimit = search.get("limit");
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new FittingHttpError(400, "INVALID_REQUEST", "Invalid request", "limit must be an integer between 1 and 200.");
  }
  const signature = createHash("sha256").update(signatureInput).digest("base64url").slice(0, 22);
  const cursor = search.get("cursor");
  if (!cursor) return { limit, offset: 0, signature };
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { o?: unknown; s?: unknown };
    if (typeof decoded.o !== "number" || !Number.isInteger(decoded.o) || decoded.o < 0 || decoded.s !== signature) throw new Error("invalid cursor");
    return { limit, offset: decoded.o, signature };
  } catch {
    throw new FittingHttpError(400, "CURSOR_INVALID", "Invalid cursor", "The cursor is malformed, stale, or belongs to different filters or build.");
  }
}

function page<T>(records: T[], options: { limit: number; offset: number; signature: string }): { records: T[]; page: { limit: number; nextCursor: string | null } } {
  const selected = records.slice(options.offset, options.offset + options.limit);
  const nextOffset = options.offset + selected.length;
  const nextCursor = nextOffset < records.length
    ? Buffer.from(JSON.stringify({ o: nextOffset, s: options.signature }), "utf8").toString("base64url")
    : null;
  return { records: selected, page: { limit: options.limit, nextCursor } };
}

function querySignature(selection: DatasetSelection, route: string, search: URLSearchParams): string {
  const entries = [...search.entries()]
    .filter(([key]) => key !== "cursor" && key !== "limit")
    .sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv));
  return JSON.stringify([selection.channel, selection.buildId, route, entries]);
}

async function componentRows(selection: DatasetSelection): Promise<Array<{ row: Row; fallbackType: string }>> {
  const families = await Promise.all(
    COMPONENT_FILES.map(async ([fileName, fallbackType]) => {
      try {
        return { payload: await loadRegistry(selection, fileName), fallbackType };
      } catch (error) {
        if (OPTIONAL_PUBLIC_REGISTRIES.has(fileName) && isDatasetUnavailable(error)) {
          return { payload: { records: [] }, fallbackType };
        }
        throw error;
      }
    }),
  );
  const byId = new Map<string, { row: Row; fallbackType: string }>();
  for (const family of families) {
    for (const row of family.payload.records) {
      const id = canonicalId(row.entityClass ?? row.componentKey ?? row.thrusterKey);
      if (id) byId.set(id, { row, fallbackType: family.fallbackType });
    }
  }
  return [...byId.values()];
}

export async function getMeta(selection: DatasetSelection): Promise<unknown> {
  const headers = (await Promise.all(PUBLIC_REGISTRIES.map(async (name) => {
    try {
      return await readRegistryHeader(selection, name);
    } catch (error) {
      if (OPTIONAL_PUBLIC_REGISTRIES.has(name) && isDatasetUnavailable(error)) return null;
      throw error;
    }
  }))).filter((header) => header !== null);
  return {
    meta: await fittingApiMeta(selection),
    data: { registries: headers.map((entry) => ({ name: entry.name, recordCount: entry.recordCount })) },
  };
}

export async function listShips(selection: DatasetSelection, search: URLSearchParams): Promise<unknown> {
  const payload = await loadRegistry(selection, "ships.json");
  const q = (search.get("q") ?? "").toLowerCase();
  const manufacturer = (search.get("manufacturer") ?? "").toLowerCase();
  const vehicleType = (search.get("vehicleType") ?? "").toLowerCase();
  const ground = search.get("groundVehicle");
  if (ground !== null && ground !== "true" && ground !== "false") throw new FittingHttpError(400, "INVALID_REQUEST", "Invalid request", "groundVehicle must be true or false.");
  const sort = search.get("sort") ?? "displayName";
  if (!["displayName", "-displayName", "manufacturer", "-manufacturer"].includes(sort)) throw new FittingHttpError(400, "INVALID_REQUEST", "Invalid request", "Unsupported ship sort.");
  const field = sort.replace(/^-/, "");
  const direction = sort.startsWith("-") ? -1 : 1;
  const records = payload.records.map(shipSummary).filter((row) => {
    const haystack = `${row.name} ${row.displayName} ${row.manufacturer ?? ""}`.toLowerCase();
    return (!q || haystack.includes(q))
      && (!manufacturer || String(row.manufacturer ?? "").toLowerCase() === manufacturer)
      && (!vehicleType || String(row.vehicleType).toLowerCase() === vehicleType)
      && (ground === null || row.isGroundVehicle === (ground === "true"));
  }).sort((a, b) => direction * String(a[field] ?? "").localeCompare(String(b[field] ?? "")) || String(a.id).localeCompare(String(b.id)));
  const paged = page(records, pagination(search, querySignature(selection, "ships", search)));
  return { meta: await fittingApiMeta(selection), data: paged.records, page: paged.page };
}

export async function getShip(selection: DatasetSelection, shipIdInput: string, search: URLSearchParams): Promise<unknown> {
  const shipId = requestedId(shipIdInput, "ship");
  const [ships, performance] = await Promise.all([loadRegistry(selection, "ships.json"), loadRegistry(selection, "ship_performance.json")]);
  const row = ships.records.find((item) => canonicalId(item.entityClass ?? item.shipKey) === shipId);
  if (!row) throw new FittingHttpError(404, "RESOURCE_NOT_FOUND", "Resource not found", "No fitting ship matched the supplied identifier.");
  const performanceRow = performance.records.find((item) => canonicalId(item.shipKey) === shipId) ?? {};
  const data: Record<string, unknown> = {
    ...shipSummary(row),
    description: text(row.description),
    className: text(row.className),
    hullHP: numberValue(row.hullHP),
    mitigation: shipMitigation(row),
    performance: {
      scmSpeed: numberValue(performanceRow.scmSpeed),
      maxSpeed: numberValue(performanceRow.maxSpeed),
      pitchRate: numberValue(performanceRow.pitchRate),
      yawRate: numberValue(performanceRow.yawRate),
      rollRate: numberValue(performanceRow.rollRate),
      boostSpeedForward: numberValue(performanceRow.boostSpeedForward),
      boostSpeedBackward: numberValue(performanceRow.boostSpeedBackward),
      boostCapacity: numberValue(performanceRow.boostCapacity),
      boostRegen: numberValue(performanceRow.boostRegen),
    },
  };
  if (includeDiagnostics(search)) data.diagnostics = diagnostics(row);
  return { meta: await fittingApiMeta(selection), data };
}

function hardpointNode(row: Row, flat: boolean, parentId: string | null = null): Record<string, unknown> {
  const id = text(row.portId ?? row.id);
  if (!id) throw new FittingHttpError(409, "DATASET_SCHEMA_UNSUPPORTED", "Dataset schema unsupported", "A hardpoint has no stable port identifier.");
  const defaultItem = row.defaultItem && typeof row.defaultItem === "object" ? row.defaultItem as Row : {};
  const children = Array.isArray(row.children) ? row.children.filter((item): item is Row => !!item && typeof item === "object") : [];
  return {
    id,
    parentId,
    name: text(row.portName ?? row.name) ?? id,
    type: text(row.portType ?? row.type ?? row.category) ?? "unknown",
    subtype: text(row.portSubType ?? row.subtype),
    size: { min: numberValue(row.minSize), max: numberValue(row.maxSize), exact: numberValue(row.exactSize ?? row.size) },
    editable: row.editable !== false,
    bespoke: booleanValue(row.bespoke),
    locked: booleanValue(row.locked),
    defaultComponentId: canonicalId(row.resolvedDefaultComponentKey ?? defaultItem.resolvedComponentKey),
    compatibilityStatus: text(row.compatibilityStatus),
    confidence: confidence(row.confidence),
    children: flat ? [] : children.map((child) => hardpointNode(child, false, id)),
  };
}

function flattenHardpoints(rows: Row[], parentId: string | null = null): Record<string, unknown>[] {
  const output: Record<string, unknown>[] = [];
  for (const row of rows) {
    const shaped = hardpointNode(row, true, parentId);
    output.push(shaped);
    const id = String(shaped.id);
    const children = Array.isArray(row.children) ? row.children.filter((item): item is Row => !!item && typeof item === "object") : [];
    output.push(...flattenHardpoints(children, id));
  }
  return output;
}

export async function getHardpoints(selection: DatasetSelection, shipIdInput: string, search: URLSearchParams): Promise<unknown> {
  const shipId = requestedId(shipIdInput, "ship");
  const format = search.get("format") ?? "tree";
  if (format !== "tree" && format !== "flat") throw new FittingHttpError(400, "INVALID_REQUEST", "Invalid request", "format must be tree or flat.");
  const payload = await loadRegistry(selection, "ship_hardpoints.json");
  const row = payload.records.find((item) => canonicalId(item.shipKey) === shipId);
  if (!row) throw new FittingHttpError(404, "RESOURCE_NOT_FOUND", "Resource not found", "No hardpoints were found for the supplied ship.");
  const tree = Array.isArray(row.tree) ? row.tree.filter((item): item is Row => !!item && typeof item === "object") : [];
  const data: Record<string, unknown> = {
    shipId,
    format,
    ports: format === "flat" ? flattenHardpoints(tree) : tree.map((node) => hardpointNode(node, false)),
  };
  if (includeDiagnostics(search)) data.diagnostics = diagnostics(row);
  return { meta: await fittingApiMeta(selection), data };
}

export async function getLoadout(selection: DatasetSelection, shipIdInput: string, search: URLSearchParams): Promise<unknown> {
  const shipId = requestedId(shipIdInput, "ship");
  const payload = await loadRegistry(selection, "default_loadouts.json");
  const row = payload.records.find((item) => canonicalId(item.shipKey) === shipId);
  if (!row) throw new FittingHttpError(404, "RESOURCE_NOT_FOUND", "Resource not found", "No stock loadout was found for the supplied ship.");
  const entries = Array.isArray(row.entries) ? row.entries.filter((item): item is Row => !!item && typeof item === "object") : [];
  const data: Record<string, unknown> = {
    shipId,
    scope: "stock_default_loadout",
    entries: entries.map((entry) => {
      const componentId = canonicalId(entry.resolvedDefaultComponentKey);
      const rawStatus = text(entry.defaultItemStatus);
      const status = componentId ? "resolved" : rawStatus === "port_not_editable" ? "locked" : text(entry.defaultItemRef) ? "unresolved" : "empty";
      return { portId: text(entry.portPath ?? entry.portName) ?? "unknown", componentId, status, confidence: confidence(entry.confidence) };
    }),
  };
  if (includeDiagnostics(search)) data.diagnostics = diagnostics(row);
  return { meta: await fittingApiMeta(selection), data };
}

export async function getCalculations(selection: DatasetSelection, shipIdInput: string, search: URLSearchParams): Promise<unknown> {
  const shipId = requestedId(shipIdInput, "ship");
  const payload = await loadRegistry(selection, "stock_loadout_calculations.json");
  const row = payload.records.find((item) => canonicalId(item.shipKey) === shipId);
  if (!row) throw new FittingHttpError(404, "RESOURCE_NOT_FOUND", "Resource not found", "No stock calculations were found for the supplied ship.");
  const sourceCategories = row.categories && typeof row.categories === "object" ? row.categories as Row : {};
  const categories: Record<string, unknown> = {};
  for (const name of ["power", "cooling", "shields", "weapons", "ordnance", "quantum", "radar", "performance"]) {
    const source = sourceCategories[name] && typeof sourceCategories[name] === "object" ? sourceCategories[name] as Row : null;
    if (!source) continue;
    const derivedSource = source.derived && typeof source.derived === "object" ? source.derived as Row : {};
    const derived: Row = {};
    for (const [key, value] of Object.entries(derivedSource)) {
      if (value === null || ["string", "number", "boolean"].includes(typeof value)) derived[key] = value;
    }
    categories[name] = {
      available: booleanValue(source.available),
      confidence: confidence(source.confidence),
      unavailableReason: text(source.unavailableReason),
      derived,
    };
  }
  const warningRows = Array.isArray(row.warnings) ? row.warnings : [];
  const data: Record<string, unknown> = {
    shipId,
    scope: "stock_default_loadout",
    resolutionStatus: text(row.loadoutResolutionStatus) ?? "unknown",
    componentCountsByType: row.componentCountsByType && typeof row.componentCountsByType === "object" ? row.componentCountsByType : {},
    categories,
    warnings: warningRows.map((warning) => typeof warning === "string" ? warning : text((warning as Row)?.message) ?? "Calculation warning"),
  };
  if (includeDiagnostics(search)) data.diagnostics = diagnostics(row);
  return { meta: await fittingApiMeta(selection), data };
}

export async function listComponents(selection: DatasetSelection, search: URLSearchParams): Promise<unknown> {
  const q = (search.get("q") ?? "").toLowerCase();
  const typeFilter = search.get("type");
  const sizeFilter = search.get("size");
  const grade = (search.get("grade") ?? "").toLowerCase();
  const classFilter = (search.get("class") ?? "").toLowerCase();
  const manufacturer = (search.get("manufacturer") ?? "").toLowerCase();
  if (sizeFilter !== null && (!Number.isInteger(Number(sizeFilter)) || Number(sizeFilter) < 0)) throw new FittingHttpError(400, "INVALID_REQUEST", "Invalid request", "size must be a non-negative integer.");
  const allowedTypes = [
    "ship_weapon",
    "missile",
    "missile_rack",
    "bomb",
    "bomb_rack",
    "missile_controller",
    "mining_laser",
    "salvage_head",
    "salvage_modifier",
    "fuel_nozzle",
    "shield",
    "armor",
    "power_plant",
    "cooler",
    "quantum_drive",
    "radar",
    "thruster",
    "other",
  ];
  if (typeFilter !== null && !allowedTypes.includes(typeFilter)) throw new FittingHttpError(400, "INVALID_REQUEST", "Invalid request", "Unsupported component type.");
  const sort = search.get("sort") ?? "displayName";
  if (!["displayName", "-displayName", "size", "-size", "grade", "-grade"].includes(sort)) throw new FittingHttpError(400, "INVALID_REQUEST", "Invalid request", "Unsupported component sort.");
  const field = sort.replace(/^-/, "");
  const direction = sort.startsWith("-") ? -1 : 1;
  const records = (await componentRows(selection)).map(({ row, fallbackType }) => componentSummary(row, fallbackType)).filter((row) => {
    const haystack = `${row.name} ${row.displayName} ${row.manufacturer ?? ""}`.toLowerCase();
    return (!q || haystack.includes(q))
      && (!typeFilter || row.type === typeFilter)
      && (sizeFilter === null || row.size === Number(sizeFilter))
      && (!grade || String(row.grade ?? "").toLowerCase() === grade)
      && (!classFilter || String(row.class ?? "").toLowerCase() === classFilter)
      && (!manufacturer || String(row.manufacturer ?? "").toLowerCase() === manufacturer);
  }).sort((a, b) => direction * String(a[field] ?? "").localeCompare(String(b[field] ?? ""), undefined, { numeric: true }) || String(a.id).localeCompare(String(b.id)));
  const paged = page(records, pagination(search, querySignature(selection, "components", search)));
  return { meta: await fittingApiMeta(selection), data: paged.records, page: paged.page };
}

export async function getComponent(selection: DatasetSelection, componentIdInput: string, search: URLSearchParams): Promise<unknown> {
  const componentId = requestedId(componentIdInput, "component");
  const found = (await componentRows(selection)).find(({ row }) => canonicalId(row.entityClass ?? row.componentKey ?? row.thrusterKey) === componentId);
  if (!found) throw new FittingHttpError(404, "RESOURCE_NOT_FOUND", "Resource not found", "No fitting component matched the supplied identifier.");
  const mitigation = componentMitigation(found.row, found.fallbackType);
  const data: Record<string, unknown> = { ...componentSummary(found.row, found.fallbackType), stats: componentStats(found.row), mitigation };
  const weapon = componentWeapon(found.row, found.fallbackType);
  if (weapon) data.weapon = weapon;
  const cooler = componentCooler(found.row, found.fallbackType);
  if (cooler) data.cooler = cooler;
  const ordnance = componentOrdnance(found.row, found.fallbackType);
  if (ordnance) data.ordnance = ordnance;
  if (includeDiagnostics(search)) data.diagnostics = diagnostics(found.row);
  return { meta: await fittingApiMeta(selection), data };
}

export async function getAmmo(selection: DatasetSelection, ammoIdInput: string, search: URLSearchParams): Promise<unknown> {
  const ammoId = requestedId(ammoIdInput, "ammo");
  const payload = await loadRegistry(selection, "vehicle_ammo.json");
  const row = payload.records.find((item) => canonicalId(item.ammoParamsRecord ?? item.ammoKey) === ammoId);
  if (!row) throw new FittingHttpError(404, "RESOURCE_NOT_FOUND", "Resource not found", "No vehicle ammo matched the supplied identifier.");
  const data: Record<string, unknown> = {
    id: ammoId,
    alphaDamage: numberValue(row.alphaDamageTotal),
    projectileSpeed: numberValue(row.projectileSpeed),
    projectileLifetime: numberValue(row.projectileLifetime),
    calculatedRange: numberValue(row.calculatedRange),
    damage: {
      physical: numberValue(row.damagePhysical),
      energy: numberValue(row.damageEnergy),
      distortion: numberValue(row.damageDistortion),
      thermal: numberValue(row.damageThermal),
      biochemical: numberValue(row.damageBiochemical),
      stun: numberValue(row.damageStun),
    },
    mitigation: ammoMitigation(row),
    confidence: confidence(row.confidence),
  };
  if (includeDiagnostics(search)) data.diagnostics = diagnostics(row);
  return { meta: await fittingApiMeta(selection), data };
}

export async function listCompatibleComponents(
  selection: DatasetSelection,
  shipIdInput: string,
  portId: string,
  search: URLSearchParams,
): Promise<unknown> {
  const shipId = requestedId(shipIdInput, "ship");
  const payload = await loadRegistry(selection, "compatible_items_by_port.json");
  const ship = payload.records.find((item) => canonicalId(item.shipKey) === shipId);
  if (!ship) throw new FittingHttpError(404, "RESOURCE_NOT_FOUND", "Resource not found", "No compatibility data was found for the supplied ship.");
  const ports = ship.ports && typeof ship.ports === "object" ? ship.ports as Row : {};
  const rule = ports[portId] && typeof ports[portId] === "object" ? ports[portId] as Row : null;
  if (!rule) throw new FittingHttpError(404, "RESOURCE_NOT_FOUND", "Resource not found", "No fitting port matched the supplied identifier.");
  const keys = Array.isArray(rule.compatibleComponentKeys) ? rule.compatibleComponentKeys : [];
  const components = new Map((await componentRows(selection)).map(({ row, fallbackType }) => [canonicalId(row.entityClass ?? row.componentKey ?? row.thrusterKey), componentSummary(row, fallbackType)]));
  const records = keys.map(canonicalId).filter((id): id is string => id !== null).map((id) => components.get(id)).filter((item): item is Record<string, unknown> => !!item && item.selectionEligible !== false)
    .sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)) || String(a.id).localeCompare(String(b.id)));
  const paged = page(records, pagination(search, querySignature(selection, `compatibility:${shipId}:${portId}`, search)));
  const rawStatus = text(rule.compatibilityStatus);
  const status = rawStatus === "known" ? (records.length > 0 ? "known" : "none") : "unknown";
  return {
    meta: await fittingApiMeta(selection),
    data: {
      shipId,
      portId,
      status,
      constraint: {
        type: text(rule.portType),
        subtype: text(rule.portSubType),
        minSize: numberValue(rule.minSize),
        maxSize: numberValue(rule.maxSize),
        exactSize: numberValue(rule.exactSize),
        bespoke: booleanValue(rule.bespoke),
        editable: rule.editable !== false,
      },
      components: paged.records,
    },
    page: paged.page,
  };
}
