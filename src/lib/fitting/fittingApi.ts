import { apiUrl } from "../apiUrl";
import {
  appendFittingBuildQuery,
  captureFittingApiMeta,
  getFittingBuildContext,
  getFittingBuildId,
  getFittingChannel,
  setFittingChannel,
  type FittingBuildContext,
  type FittingChannel,
} from "./fittingBuildContext";

export type FittingConfidence = "high" | "medium" | "low";
export type { FittingBuildContext, FittingChannel };
export { getFittingBuildContext, getFittingBuildId, getFittingChannel, setFittingChannel };

export type FittingApiMeta = {
  apiVersion: "1";
  artifactSchemaVersion: number;
  channel: "LIVE" | "PTU";
  buildId: string;
  generatedAt: string;
};

export type ResolvedFittingBuildContext = {
  channel: FittingChannel;
  buildId: string;
};

type Page = { limit: number; nextCursor: string | null };
type DetailResponse<T> = { meta: FittingApiMeta; data: T };
type ListResponse<T> = DetailResponse<T[]> & { page: Page };

type FittingBuildContextBootstrapper = () => Promise<void>;

let ensureFittingBuildContextInflight: Promise<ResolvedFittingBuildContext> | null = null;
let fittingBuildContextBootstrapper: FittingBuildContextBootstrapper | null = null;

function withFittingBuild(path: string): string {
  return appendFittingBuildQuery(path);
}

function captureResponseMeta(payload: unknown): void {
  if (!payload || typeof payload !== "object") return;
  const meta = (payload as { meta?: FittingApiMeta }).meta;
  if (!meta?.buildId) return;
  captureFittingApiMeta(meta);
}

/**
 * Resolves channel + buildId before any patch-static component-detail GET.
 * Bootstrap may use channel-only `/meta`; component-detail never starts until buildId is known.
 */
export async function ensureFittingBuildContext(
  signal?: AbortSignal,
): Promise<ResolvedFittingBuildContext> {
  const current = getFittingBuildContext();
  if (current.buildId) {
    return { channel: current.channel, buildId: current.buildId };
  }

  if (!ensureFittingBuildContextInflight) {
    ensureFittingBuildContextInflight = (async () => {
      if (fittingBuildContextBootstrapper) {
        await fittingBuildContextBootstrapper();
      } else {
        await readResponse<DetailResponse<unknown>>(
          withFittingBuild("/api/v1/fitting/meta"),
          signal,
        );
      }

      const resolved = getFittingBuildContext();
      if (!resolved.buildId) {
        throw new Error("Fitting buildId unresolved after meta bootstrap");
      }
      return { channel: resolved.channel, buildId: resolved.buildId };
    })().finally(() => {
      ensureFittingBuildContextInflight = null;
    });
  }

  return ensureFittingBuildContextInflight;
}

export function setFittingBuildContextBootstrapperForTests(
  bootstrapper: FittingBuildContextBootstrapper | null,
): void {
  fittingBuildContextBootstrapper = bootstrapper;
  ensureFittingBuildContextInflight = null;
}

export function resetFittingBuildContextBootstrapForTests(): void {
  fittingBuildContextBootstrapper = null;
  ensureFittingBuildContextInflight = null;
}

type DamageType = "physical" | "energy" | "distortion" | "thermal" | "biochemical" | "stun";
export type DamageTypeValue = {
  value?: number | null;
  min?: number | null;
  max?: number | null;
  multiplier?: number | null;
  threshold?: number | null;
  damageCap?: number | null;
  index?: number | null;
  confidence?: FittingConfidence | string;
  sourcePath?: string | null;
};
export type DamageTypeMap = Partial<Record<DamageType, DamageTypeValue>>;

export type FittingShipMitigation = {
  hullHp: number | null;
  componentPenetrationDamageMultiplier: number | null;
  componentPenetrationDamageMultiplierProvenance: Record<string, unknown> | null;
  fusePenetrationDamageMultiplier: number | null;
  fusePenetrationDamageMultiplierProvenance: Record<string, unknown> | null;
};

export type FittingComponentMitigation =
  | {
    kind: "shield";
    shieldHp: number | null;
    maxShieldHealth: number | null;
    maxShieldRegen: number | null;
    damagedRegenDelay: number | null;
    downedRegenDelay?: number | null;
    shieldFaceCount: number | null;
    resistanceByDamageType: DamageTypeMap | null;
    absorptionByDamageType: DamageTypeMap | null;
    regenByPowerPip: FittingPowerPipPoint[] | null;
    regenPowerFormula: string | null;
    regenPowerFormulaConfidence: string | null;
  }
  | {
    kind: "armor";
    health: number | null;
    basePenetrationReduction: number | null;
    damageMultiplierByDamageType: DamageTypeMap | null;
    deflectionThresholdByDamageType: DamageTypeMap | null;
    penetrationAbsorptionByDamageType: DamageTypeMap | null;
    resistanceByDamageType: DamageTypeMap | null;
  }
  | {
    kind: "weapon_projectile";
    damage: Record<DamageType, number | null>;
    ammoPenetration: number | null;
    basePenetrationDistance: number | null;
    maxPenetrationThickness: number | null;
    penetrationParams: Record<string, unknown> | null;
  };

export type FittingAmmoMitigation = {
  damage: Record<DamageType, number | null>;
  ammoPenetration: number | null;
  basePenetrationDistance: number | null;
  maxPenetrationThickness: number | null;
  penetrationParams: Record<string, unknown> | null;
};

export type FittingShipSummary = {
  id: string;
  name: string;
  displayName: string;
  manufacturer: string | null;
  vehicleType: string;
  isGroundVehicle: boolean;
  career: string | null;
  role: string | null;
  crew: { min: number | null; max: number | null };
  cargoCapacityScu: number | null;
  confidence: FittingConfidence;
};

export type FittingShipDetail = FittingShipSummary & {
  description: string | null;
  className: string | null;
  hullHP?: number | null;
  mitigation?: FittingShipMitigation;
  performance: {
    scmSpeed?: number | null;
    maxSpeed?: number | null;
    pitchRate?: number | null;
    yawRate?: number | null;
    rollRate?: number | null;
    boostSpeedForward?: number | null;
    boostSpeedBackward?: number | null;
    boostCapacity?: number | null;
    boostRegen?: number | null;
  };
};

export function isDisplayableFittingShip(ship: FittingShipSummary): boolean {
  const label = (ship.displayName || ship.name).trim();
  return label.length > 0 && !label.startsWith("<=") && label.toLowerCase() !== "unknown";
}

export type FittingComponentSummary = {
  id: string;
  name: string;
  displayName: string;
  manufacturer: string | null;
  type: string;
  subtype: string | null;
  size: number | null;
  grade: string | null;
  class: string | null;
  confidence: FittingConfidence;
  selectionEligible?: boolean | null;
  referenceStatus?: string | null;
};

export type FittingHardpoint = {
  id: string;
  parentId: string | null;
  name: string;
  type: string;
  subtype: string | null;
  size?: { min: number | null; max: number | null; exact: number | null };
  editable: boolean;
  bespoke: boolean;
  locked: boolean;
  defaultComponentId: string | null;
  compatibilityStatus: string | null;
  confidence: FittingConfidence;
  children: FittingHardpoint[];
};

export type FittingLoadoutEntry = {
  portId: string;
  componentId: string | null;
  status: "resolved" | "unresolved" | "empty" | "locked" | "unknown";
  confidence: FittingConfidence;
};

export type FittingCalculationCategory = {
  available: boolean;
  confidence: FittingConfidence;
  unavailableReason: string | null;
  derived: Record<string, string | number | boolean | null>;
  extracted?: Record<string, unknown>;
};

export type FittingCalculation = {
  shipId: string;
  scope: "stock_default_loadout";
  resolutionStatus: string;
  componentCountsByType: Record<string, number>;
  categories: Partial<Record<"power" | "cooling" | "shields" | "weapons" | "ordnance" | "quantum" | "radar" | "performance", FittingCalculationCategory>>;
  warnings: string[];
};

export type FittingValidationResult = {
  valid: boolean;
  shipId: string;
  portsChecked: number;
  missingRequiredPorts: string[];
  emptyOptionalPorts: string[];
  incompatibleItems: Array<{ portId: string; componentId: string; reason: string; confidence: FittingConfidence }>;
  lockedBespokePorts: string[];
  unknownItemIds: Array<{ portId: string; componentId: string }>;
  unknownPortIds: string[];
  mismatchReasons: Array<{ portId: string; componentId: string; kind: string; message: string; confidence: FittingConfidence }>;
  confidence: FittingConfidence;
  unresolvedReferences: Array<{ kind: string; message: string; confidence: FittingConfidence }>;
};

export type FittingCalculateResult = {
  shipId: string;
  scope: "custom_loadout";
  resolutionStatus: string;
  componentCountsByType: Record<string, number>;
  categories: FittingCalculation["categories"];
  summary: {
    firepower: { weaponAlphaTotal: number | null; weaponDpsTotal: number | null; weaponCount: number; confidence: FittingConfidence; inferred: boolean };
    ordnance: {
      missilePayloadDamage: number | null;
      torpedoPayloadDamage: number | null;
      bombPayloadDamage: number | null;
      totalOrdnancePayloadDamage: number | null;
      installedMissileCount: number;
      installedTorpedoCount: number;
      installedBombCount: number;
      confidence: FittingConfidence;
      inferred: boolean;
    };
    shields: { totalShieldHP: number | null; totalRegenRate: number | null; confidence: FittingConfidence; inferred: boolean };
    power: { produced: number | null; required: number | null; margin: number | null; confidence: FittingConfidence; inferred: boolean };
    cooling: { produced: number | null; required: number | null; margin: number | null; confidence: FittingConfidence; inferred: boolean };
    quantum: { componentCount: number; confidence: FittingConfidence; inferred: boolean };
    radar: { componentCount: number; maxSignatureSensitivity: number | null; confidence: FittingConfidence; inferred: boolean };
  };
  warnings: string[];
  confidence: FittingConfidence;
  unresolvedReferences: Array<{ kind: string; message: string; confidence: FittingConfidence }>;
  missingStats: Array<{ portId: string; componentId: string; fields: string[]; confidence: FittingConfidence }>;
  unknownItemIds: string[];
  stockComparison?: Record<string, unknown>;
  simulation?: FittingSimulationResult;
};

export const FITTING_SIMULATION_MODEL_VERSION = "fitting-simulation-v1" as const;

export type FittingSimulationPowerCategory =
  | "weapons"
  | "engines"
  | "quantum"
  | "radar"
  | "shields"
  | "lifeSupport"
  | "cooler1"
  | "cooler2";

export type FittingSimulationPowerAllocation = Record<FittingSimulationPowerCategory, number>;
export type FittingSimulationPowerAllocationRequest =
  Record<Exclude<FittingSimulationPowerCategory, "shields">, number>
  & Partial<Pick<FittingSimulationPowerAllocation, "shields">>;

export type FittingSimulationSourceFact = {
  componentId: string;
  mountId: string | null;
  path: string;
  value: number;
};

export type FittingSimulationMetric = {
  value: number | null;
  provenance: "derived" | "unavailable";
  formula: string | null;
  sources: FittingSimulationSourceFact[];
};

export type FittingSimulationMissingInput = {
  componentId: string | null;
  mountId: string | null;
  path: string;
  reason: string;
};

export type FittingWeaponSimulationResult = {
  componentId: string;
  mountId: string | null;
  mountTopology: "turret" | "pilot" | null;
  ammunitionModel: "energy" | "ballistic" | "unavailable";
  allocationRatio: FittingSimulationMetric;
  effectiveAmmo: FittingSimulationMetric;
  effectiveRegenPerSecond: FittingSimulationMetric;
  capacitorFillTimeSeconds: FittingSimulationMetric;
  capacitorFullRechargeTimeSeconds: FittingSimulationMetric;
  triggerTimeSeconds: FittingSimulationMetric;
  maxShotsBeforeOverheat: FittingSimulationMetric;
  overheatInterruptions: FittingSimulationMetric;
  overheatTimeSeconds: FittingSimulationMetric;
  shotsFired: FittingSimulationMetric;
  damage: FittingSimulationMetric;
  dps: FittingSimulationMetric;
  completeMagazinesFired: number | null;
  magazineStartTimesSeconds: number[];
  directInputs: FittingSimulationSourceFact[];
  assumptions: string[];
  missingInputs: FittingSimulationMissingInput[];
};

export type FittingSimulationResult = {
  modelVersion: typeof FITTING_SIMULATION_MODEL_VERSION;
  durationSeconds: number;
  power: {
    capacitySegments: FittingSimulationMetric;
    weaponPoolCapacitySegments: FittingSimulationMetric;
    allocatedSegments: FittingSimulationMetric;
    marginSegments: FittingSimulationMetric;
    allocatedByCategory: FittingSimulationPowerAllocation;
  };
  cooling: {
    capacity: FittingSimulationMetric;
    demand: FittingSimulationMetric;
    utilizationPercent: FittingSimulationMetric;
  };
  shields?: {
    maxRegenPerSecond: FittingSimulationMetric;
    effectiveRegenPerSecond: FittingSimulationMetric;
  };
  weapons: FittingWeaponSimulationResult[];
  weaponsSummary: {
    totalDamage: FittingSimulationMetric;
    dps: FittingSimulationMetric;
    simulatedWeaponCount: FittingSimulationMetric;
  };
  provenance: {
    directInputs: FittingSimulationSourceFact[];
    derivedModel: typeof FITTING_SIMULATION_MODEL_VERSION;
  };
  assumptions: string[];
  missingInputs: FittingSimulationMissingInput[];
};

export type FittingSimulationRequest = {
  modelVersion: typeof FITTING_SIMULATION_MODEL_VERSION;
  durationSeconds: number;
  powerAllocation: FittingSimulationPowerAllocationRequest;
};

export type FittingLoadoutRequest = {
  shipId: string;
  loadout: Record<string, string | null>;
  options?: { compareToStock?: boolean };
  simulation?: FittingSimulationRequest;
};

async function writeJson<T>(path: string, payload: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(problem?.detail ?? `Fitting API request failed: ${response.status}`);
  }
  const responseBody = await response.json() as T;
  captureResponseMeta(responseBody);
  return responseBody;
}

export async function validateFittingLoadout(request: FittingLoadoutRequest, signal?: AbortSignal): Promise<FittingValidationResult> {
  return (await writeJson<DetailResponse<FittingValidationResult>>(withFittingBuild("/api/v1/fitting/validate"), request, signal)).data;
}

export async function calculateFittingLoadout(request: FittingLoadoutRequest, signal?: AbortSignal): Promise<FittingCalculateResult> {
  return (await writeJson<DetailResponse<FittingCalculateResult>>(withFittingBuild("/api/v1/fitting/calculate"), request, signal)).data;
}

async function readResponse<T>(
  path: string,
  signal?: AbortSignal,
  forceReload = false,
  resolveCached?: () => T | null | undefined,
): Promise<T> {
  const response = await fetch(apiUrl(path), {
    signal,
    cache: forceReload ? "no-store" : "default",
  });

  if (response.status === 304) {
    const cached = resolveCached?.();
    if (cached != null) return cached;
    if (!forceReload) return readResponse<T>(path, signal, true, resolveCached);
    throw new Error("Fitting API returned 304 without a response body");
  }

  if (!response.ok) {
    throw new Error(`Fitting API request failed: ${response.status}`);
  }

  const raw = await response.text();
  if (!raw.trim()) {
    const cached = resolveCached?.();
    if (cached != null) return cached;
    if (!forceReload) return readResponse<T>(path, signal, true, resolveCached);
    throw new Error("Fitting API returned an empty response body");
  }

  const payload = JSON.parse(raw) as T;
  captureResponseMeta(payload);
  return payload;
}

async function readAllPages<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const records: T[] = [];
  let cursor: string | null = null;
  for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const cursorQuery: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
    const response: ListResponse<T> = await readResponse<ListResponse<T>>(`${path}${separator}limit=200${cursorQuery}`, signal);
    records.push(...response.data);
    cursor = response.page.nextCursor;
    if (!cursor) return records;
  }
  throw new Error("Fitting API pagination exceeded the safety limit.");
}

export function listFittingShips(signal?: AbortSignal): Promise<FittingShipSummary[]> {
  return readAllPages<FittingShipSummary>(withFittingBuild("/api/v1/fitting/ships"), signal);
}

export function listFittingComponents(signal?: AbortSignal): Promise<FittingComponentSummary[]> {
  return readAllPages<FittingComponentSummary>(withFittingBuild("/api/v1/fitting/components"), signal);
}

export async function getFittingShip(shipId: string, signal?: AbortSignal): Promise<FittingShipDetail> {
  return (await readResponse<DetailResponse<FittingShipDetail>>(withFittingBuild(`/api/v1/fitting/ships/${encodeURIComponent(shipId)}`), signal)).data;
}

export async function getFittingHardpoints(shipId: string, signal?: AbortSignal): Promise<FittingHardpoint[]> {
  const response = await readResponse<DetailResponse<{ shipId: string; format: "flat"; ports: FittingHardpoint[] }>>(
    withFittingBuild(`/api/v1/fitting/ships/${encodeURIComponent(shipId)}/hardpoints?format=flat`),
    signal,
  );
  return response.data.ports;
}

export async function getFittingLoadout(shipId: string, signal?: AbortSignal): Promise<FittingLoadoutEntry[]> {
  const response = await readResponse<DetailResponse<{ shipId: string; scope: "stock_default_loadout"; entries: FittingLoadoutEntry[] }>>(
    withFittingBuild(`/api/v1/fitting/ships/${encodeURIComponent(shipId)}/loadout`),
    signal,
  );
  return response.data.entries;
}

export async function getFittingCalculations(shipId: string, signal?: AbortSignal): Promise<FittingCalculation> {
  return (await readResponse<DetailResponse<FittingCalculation>>(
    withFittingBuild(`/api/v1/fitting/ships/${encodeURIComponent(shipId)}/calculations`),
    signal,
  )).data;
}

export type FittingComponentStats = {
  mass?: number | null;
  volume?: number | null;
  health?: number | null;
  powerDraw?: number | null;
  coolantUsage?: number | null;
  coolingDraw?: number | null;
  coolingRequired?: number | null;
  heatGenerated?: number | null;
  infraredEmission?: number | null;
  electromagneticEmission?: number | null;
  alphaDamage?: number | null;
  explosionRadiusMin?: number | null;
  explosionRadiusMax?: number | null;
  maxLifetime?: number | null;
  armTime?: number | null;
  igniteTime?: number | null;
  collisionDelayTime?: number | null;
  explosionSafetyDistance?: number | null;
  projectileProximity?: number | null;
  linearSpeed?: number | null;
  boostPhaseDuration?: number | null;
  fuelTankSize?: number | null;
  trackingSignalMin?: number | null;
  lockTime?: number | null;
  lockingAngle?: number | null;
  lockRangeMin?: number | null;
  lockRangeMax?: number | null;
  signalResilienceMin?: number | null;
  signalResilienceMax?: number | null;
  launchDelay?: number | null;
  missileSlotCount?: number | null;
  bombSlotCount?: number | null;
  ordnanceSlotCount?: number | null;
  lockAngleAtMin?: number | null;
  lockAngleAtMax?: number | null;
  maxArmedMissiles?: number | null;
  launchCooldownTime?: number | null;
  dragAreaRadius?: number | null;
  centreOfPressureOffsetY?: number | null;
  maximumDropAngleFromFlatFlight?: number | null;
  dps?: number | null;
  theoreticalDps?: number | null;
  damageOver60Seconds?: number | null;
  sustainedDps60?: number | null;
  projectileSpeed?: number | null;
  projectileLifetime?: number | null;
  calculatedRange?: number | null;
  projectileMaxTravel?: number | null;
  ammoCapacity?: number | null;
  initialAmmoCount?: number | null;
  maxAmmoCount?: number | null;
  ammoCostPerShot?: number | null;
  requestedAmmoLoad?: number | null;
  maxAmmoLoad?: number | null;
  regenerationCostPerBullet?: number | null;
  requestedRegenPerSec?: number | null;
  maxRegenPerSec?: number | null;
  regenerationCooldown?: number | null;
  shieldHp?: number | null;
  regenRate?: number | null;
  powerGenerated?: number | null;
  coolingGenerated?: number | null;
  quantumSpeed?: number | null;
  spoolTime?: number | null;
  quantumCooldown?: number | null;
  quantumFuelRequirement?: number | null;
  /** Compatibility alias for quantumFuelRequirement. */
  fuelRate?: number | null;
  calibrationDelayInSeconds?: number | null;
  calibrationRate?: number | null;
  calibrationTime?: number | null;
  minCalibrationRequirement?: number | null;
  maxCalibrationRequirement?: number | null;
  quantumStageOneAccelRate?: number | null;
  quantumStageTwoAccelRate?: number | null;
  detectionRange?: number | null;
  scanRange?: number | null;
  scanRate?: number | null;
  scanCooldownTime?: number | null;
  signatureSensitivity?: number | null;
  thrustCapacity?: number | null;
  damageEnergy?: number | null;
  damagePhysical?: number | null;
  damageThermal?: number | null;
  damageDistortion?: number | null;
  damageBiochemical?: number | null;
  damageStun?: number | null;
  fireRateRpm?: number | null;
  burstShotCount?: number | null;
  heatPerShot?: number | null;
  heatCapacity?: number | null;
  minimumTemperature?: number | null;
  overheatTemperature?: number | null;
  cooldownRate?: number | null;
  coolingPerSecond?: number | null;
  timeTillCoolingStarts?: number | null;
  overheatFixTime?: number | null;
  postOverheatTemperature?: number | null;
  spreadMin?: number | null;
  spreadMax?: number | null;
  spreadFirstAttack?: number | null;
  spreadPerAttack?: number | null;
  spreadDecay?: number | null;
  falloffStart?: number | null;
  damageDropPerMeter?: number | null;
  damageDropMinDamage?: number | null;
  penetrationNearRadius?: number | null;
  penetrationFarRadius?: number | null;
  bulletImpulseFalloffMinDistance?: number | null;
  bulletImpulseDropFalloff?: number | null;
  bulletImpulseMaxFalloff?: number | null;
  powerUsage?: number | null;
  powerConsumptionNominal?: number | null;
  minimumConsumptionFraction?: number | null;
  powerConsumptionMinimum?: number | null;
  powerInputMaximum?: number | null;
  powerInputMinimum?: number | null;
  powerInputMaximumPips?: number | null;
  powerInputMinimumPips?: number | null;
  maxPenetrationThickness?: number | null;
  distortionResistance?: number | null;
  crossSection?: number | null;
  radarEmission?: number | null;
  emSignatureNominal?: number | null;
  emSignatureDecayRate?: number | null;
  repairRestoreRatio?: number | null;
  selfRepairMaxCount?: number | null;
  selfRepairTime?: number | null;
  selfRepairHealthRatio?: number | null;
  selfRepairBaselineHp?: number | null;
  miningPower?: number | null;
  extractionPower?: number | null;
  instabilityModifier?: number | null;
  resistanceModifier?: number | null;
  fractureWindowSize?: number | null;
  optimalChargeRate?: number | null;
  laserRange?: number | null;
  beamRange?: number | null;
  heatPerSecond?: number | null;
  wearPerSecond?: number | null;
  powerUsageMin?: number | null;
  powerUsageMax?: number | null;
  throttleMinimum?: number | null;
  hullScrapingSpeedMultiplier?: number | null;
  hullScrapingRadiusMultiplier?: number | null;
  hullScrapingEfficiencyMultiplier?: number | null;
  hullScrapingSpeedModifier?: number | null;
  hullScrapingRadiusModifier?: number | null;
  hullScrapingEfficiencyModifier?: number | null;
  materialEfficiency?: number | null;
  maxHealthRepairRate?: number | null;
  maxDamageMapRepairRate?: number | null;
  tractorMinForce?: number | null;
  tractorMaxForce?: number | null;
  tractorMinDistance?: number | null;
  tractorMaxDistance?: number | null;
  tractorFullStrengthDistance?: number | null;
  tractorMaxVolume?: number | null;
  fuelTransferRate?: number | null;
  quantumFuelTransferRate?: number | null;
  captureRadius?: number | null;
  distortionMaximum?: number | null;
  onlineEmSignature?: number | null;
  onlineIrSignature?: number | null;
  thermalEqualizationRate?: number | null;
};

export type FittingPowerPipPoint = {
  pips: number | null;
  percentAssigned: number | null;
  modifier: number | null;
  range: string | null;
  value: number | null;
};

export type FittingCoolerDetail = {
  coolingGeneratedByPowerPip: FittingPowerPipPoint[] | null;
  coolingGeneratedPowerFormula: string | null;
  coolingGeneratedPowerFormulaConfidence: string | null;
};

export type FittingWeaponAction = {
  kind: "standard" | "charged" | "beam" | "burst" | "rapid" | "unknown";
  name: string | null;
  actionIndex: number | null;
  sourcePath: string | null;
  fireRateRpm: number | null;
  heatPerShot: number | null;
  heatPerSecond: number | null;
  ammoCost: number | null;
  pelletCount: number | null;
  damageMultiplier: number | null;
  spreadMin: number | null;
  spreadMax: number | null;
  spreadFirstAttack: number | null;
  spreadPerAttack: number | null;
  spreadDecay: number | null;
  chargeTime: number | null;
  chargeUpTime: number | null;
  chargeDownTime: number | null;
  cooldownTime: number | null;
  spinUpTime: number | null;
  spinDownTime: number | null;
  fireDuringSpinUp: boolean | null;
  fullDamageRange: number | null;
  zeroDamageRange: number | null;
  damagePerSecondTotal: number | null;
};

export type FittingWeaponDetail = {
  recordSchemaVersion: number | null;
  actions: FittingWeaponAction[];
  dpsModelVersion: string | null;
  dpsAssumptions: string[];
  dpsConfidence: string | null;
  dpsPolicy: string | null;
};

export type FittingOrdnanceDetail = {
  kind: "missile";
  ordnanceClass: string | null;
  trackingSignalType: string | null;
  requiresLauncher: boolean | null;
} | {
  kind: "bomb";
  ordnanceClass: string;
  requiresLauncher: boolean | null;
} | {
  kind: "missile_rack" | "bomb_rack";
  supportedOrdnanceSizes: number[];
  ports: Array<{ name: string | null; minSize: number | null; maxSize: number | null }>;
};

export type FittingComponentDetail = FittingComponentSummary & {
  stats: FittingComponentStats;
  mitigation: FittingComponentMitigation | null;
  weapon?: FittingWeaponDetail;
  cooler?: FittingCoolerDetail;
  ordnance?: FittingOrdnanceDetail;
};

export type FittingPortConstraint = {
  type: string | null;
  subtype: string | null;
  minSize: number | null;
  maxSize: number | null;
  exactSize: number | null;
  bespoke: boolean;
  editable: boolean;
};

export type FittingCompatibleComponentsResult = {
  shipId: string;
  portId: string;
  status: "known" | "unknown" | "none";
  constraint: FittingPortConstraint;
  components: FittingComponentSummary[];
};

export async function listCompatibleComponents(
  shipId: string,
  portId: string,
  signal?: AbortSignal,
): Promise<FittingCompatibleComponentsResult> {
  const components: FittingComponentSummary[] = [];
  let cursor: string | null = null;
  let result: FittingCompatibleComponentsResult | null = null;

  for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
    const cursorQuery: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
    const response: DetailResponse<Omit<FittingCompatibleComponentsResult, "components"> & { components: FittingComponentSummary[] }> & { page: Page } = await readResponse(
      withFittingBuild(
        `/api/v1/fitting/ships/${encodeURIComponent(shipId)}/ports/${encodeURIComponent(portId)}/compatible-components?limit=200${cursorQuery}`,
      ),
      signal,
    );
    if (!result) {
      result = { ...response.data, components: [] };
    }
    components.push(...response.data.components);
    cursor = response.page.nextCursor;
    if (!cursor) break;
  }

  if (!result) {
    throw new Error("No compatibility data returned.");
  }

  return { ...result, components };
}

export async function getFittingComponent(
  componentId: string,
  signal?: AbortSignal,
  resolveDetailCached?: () => FittingComponentDetail | null | undefined,
): Promise<FittingComponentDetail> {
  const resolveResponseCached = resolveDetailCached
    ? (): DetailResponse<FittingComponentDetail> | null => {
      const detail = resolveDetailCached();
      if (!detail) return null;
      const { channel, buildId } = getFittingBuildContext();
      return {
        meta: {
          apiVersion: "1",
          artifactSchemaVersion: 0,
          channel,
          buildId: buildId ?? "",
          generatedAt: "",
        },
        data: detail,
      };
    }
    : undefined;

  try {
    return (await readResponse<DetailResponse<FittingComponentDetail>>(
      withFittingBuild(`/api/v1/fitting/components/${encodeURIComponent(componentId)}`),
      signal,
      false,
      resolveResponseCached,
    )).data;
  } catch (error) {
    const cached = resolveDetailCached?.();
    if (cached) return cached;
    throw error;
  }
}
