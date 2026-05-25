import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonRecord = Record<string, unknown>;

type SourceMaterial = {
  slot?: unknown;
  slotDisplayName?: unknown;
  costType?: unknown;
  materialId?: unknown;
  materialKey?: unknown;
  materialName?: unknown;
  costId?: unknown;
  quantity?: unknown;
  unit?: unknown;
  unitType?: unknown;
  minQuality?: unknown;
};

type VehicleBlueprint = {
  displayName?: unknown;
  componentType?: unknown;
  size?: unknown;
  grade?: unknown;
  class?: unknown;
  manufacturerGuid?: unknown;
  manufacturer?: unknown;
  blueprintGuid?: unknown;
  blueprintName?: unknown;
  blueprintPath?: unknown;
  entityClass?: unknown;
  craftTimeSeconds?: unknown;
  baseStats?: unknown;
  materials?: SourceMaterial[];
  qualityModifiers?: JsonRecord[];
  rewardPools?: JsonRecord[];
};

type FpsBlueprint = {
  id?: unknown;
  displayName?: unknown;
  fpsCategory?: unknown;
  sourceBranch?: unknown;
  category?: unknown;
  weaponClass?: unknown;
  armorSlot?: unknown;
  armorWeight?: unknown;
  armorFamily?: unknown;
  ammoClass?: unknown;
  familyKey?: unknown;
  familyDisplayName?: unknown;
  baseName?: unknown;
  variantName?: unknown;
  blueprintGuid?: unknown;
  blueprintName?: unknown;
  blueprintPath?: unknown;
  recordPath?: unknown;
  sourceRelativePath?: unknown;
  entityClass?: unknown;
  craftTimeSeconds?: unknown;
  materials?: SourceMaterial[];
  materialRequirements?: SourceMaterial[];
  qualityModifiers?: JsonRecord[];
};

type IndexMaterial = {
  slot: string | null;
  name: string;
  quantity: number;
  unit: string | null;
  materialId: string | null;
  costId: string | null;
  materialKey: string | null;
  minQuality: number | null;
};

type CardMetric = {
  label: string;
  value: string;
  field?: string;
  confidence?: "safe" | "caution";
};

type ShieldRange = {
  min: number;
  max: number;
};

type ShieldStats = {
  maxShieldHealth: number | null;
  regenRate: number | null;
  regenTime: number | null;
  damageRegenDelay: number | null;
  downedRegenDelay: number | null;
  reservePoolRegenRate: number | null;
  reservePoolRegenTime: number | null;
  physicalAbsorption: ShieldRange | null;
  physicalResistance: ShieldRange | null;
  distortionResistance: ShieldRange | null;
  powerUsageMin: number | null;
  powerUsageMax: number | null;
  coolantUsageMin: number | null;
  coolantUsageMax: number | null;
};

type QuantumDriveStats = {
  fuelEfficiency: number | null;
  quantumFuelRequirement: number | null;
  quantumFuelConsumptionRate: number | null;
  normalJumpSpeed: number | null;
  splineJumpSpeed: number | null;
  spoolTime: number | null;
  cooldown: number | null;
  splineCooldown: number | null;
  calibrationRequirementMin: number | null;
  calibrationRequirementMax: number | null;
  calibrationAngleMin: number | null;
  calibrationAngleMax: number | null;
  calibrationDelay: number | null;
  calibrationRate: number | null;
  stageOneAcceleration: number | null;
  stageTwoAcceleration: number | null;
  engageSpeed: number | null;
  interdictionEffectTime: number | null;
  powerUsageMin: number | null;
  powerUsageMax: number | null;
  coolantUsageMin: number | null;
  coolantUsageMax: number | null;
  onlineEmSignature: number | null;
  onlineIrSignature: number | null;
  travellingEmSignature: number | null;
  travellingIrSignature: number | null;
};

type ShieldStatSource = {
  file: string;
  fields: string[];
  warnings: string[];
};

type ShieldStatRecord = {
  entityClass: string;
  stats: ShieldStats;
  source: ShieldStatSource;
};

type QuantumDriveStatRecord = {
  entityClass: string;
  stats: QuantumDriveStats;
  source: ShieldStatSource;
};

type ComponentCardIndexRecord = {
  id: string;
  name: string;
  kind: "vehicle" | "fps";
  category: string;
  type: string;
  typeLabel: string;
  size: number | null;
  grade: string | null;
  class: string | null;
  manufacturerGuid: string | null;
  manufacturer: string | null;
  family: string | null;
  familyKey: string | null;
  variants: string[];
  variantName: string | null;
  entityClass: string | null;
  craftTimeSeconds: number;
  materials: IndexMaterial[];
  searchText: string;
  searchTokens: string[];
  facets: {
    kind: "vehicle" | "fps";
    category: string;
    type: string;
    size: string | null;
    grade: string | null;
    class: string | null;
    materials: string[];
    materialNames: string[];
    weaponClass: string | null;
    armorSlot: string | null;
    armorWeight: string | null;
    ammoClass: string | null;
    sourcePools: string[];
  };
  sort: {
    name: string;
    type: string;
    craftTimeSeconds: number;
    size: number | null;
    gradeRank: number | null;
    materialCount: number;
    sourceCount: number;
    coolantGeneration?: number;
    powerDraw?: number;
  };
  card: {
    primary: CardMetric[];
    secondary: CardMetric[];
    materialsPreview: Array<Pick<IndexMaterial, "name" | "quantity" | "unit">>;
    badges: string[];
  };
  stats: {
    generic: {
      mass: number | null;
      health: number | null;
      emSignature: number | null;
      irSignature: number | null;
      distortionMaximum: number | null;
    };
    cooler: { coolantGeneration: number | null; powerDraw: number | null } | null;
    powerPlant: null;
    quantumDrive: QuantumDriveStats | null;
    shield: ShieldStats | null;
    shipWeapon: null;
    radar: null;
    tractorBeam: null;
    fpsWeapon: { weaponClass: string | null; family: string | null; variantName: string | null; variantCount: number } | null;
    fpsArmor: { armorSlot: string | null; armorWeight: string | null; family: string | null; variantName: string | null; variantCount: number } | null;
    fpsAmmo: { ammoClass: string | null; family: string | null; variantName: string | null; variantCount: number } | null;
  };
  source: {
    files: string[];
    fields: string[];
    warnings: string[];
  };
};

const root = process.cwd();
const outputPath = path.join(root, "public", "api", "crafting", "component_card_index.json");
const vehiclePath = path.join(root, "public", "api", "crafting", "blueprints.json");
const fpsPath = path.join(root, "public", "api", "crafting", "fps", "fps_blueprints.json");
const shieldRecordsDir = "D:\\scintel\\data\\libs\\foundry\\records\\entities\\scitem\\ships\\shieldgenerator";
const quantumDriveRecordsDir = "D:\\scintel\\data\\libs\\foundry\\records\\entities\\scitem\\ships\\quantumdrive";

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  cooler: "Cooler",
  dockingCollar: "Docking Collar",
  powerplant: "Power Plant",
  quantumdrive: "Quantum Drive",
  radar: "Radar",
  salvageHead: "Salvage Head",
  salvageModifier: "Salvage Modifier",
  shield: "Shield Generator",
  tractorbeam: "Tractor Beam",
  weaponGun: "Ship Weapon",
  weaponMining: "Mining Laser",
};

const FPS_TYPE_LABELS: Record<string, string> = {
  ammo: "FPS Ammo",
  armor: "FPS Armor",
  weapons: "FPS Weapon",
};

const GRADE_RANK: Record<string, number> = {
  S: 0,
  A: 1,
  B: 2,
  C: 3,
  D: 4,
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function titleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatRangePercent(range: ShieldRange): string {
  const min = formatNumber(range.min * 100);
  const max = formatNumber(range.max * 100);
  return min === max ? `${max}%` : `${min}-${max}%`;
}

function formatCraftTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function tokenize(values: unknown[]): string[] {
  const tokens = new Set<string>();
  for (const value of values) {
    const normalized = normalizeToken(String(value ?? ""));
    for (const token of normalized.split(/\s+/)) {
      if (token) tokens.add(token);
    }
  }
  return [...tokens].sort();
}

function buildSearchText(values: unknown[]): { searchText: string; searchTokens: string[] } {
  const raw = values.map((value) => String(value ?? "").toLowerCase()).join(" ");
  const compact = raw.replace(/[^a-z0-9]+/g, "");
  const searchText = `${raw} ${compact}`.replace(/\s+/g, " ").trim();
  return { searchText, searchTokens: tokenize(values) };
}

async function readJsonArray<T>(filePath: string): Promise<T[]> {
  const data = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  if (!Array.isArray(data)) {
    throw new Error(`Expected ${path.relative(root, filePath)} to contain a JSON array`);
  }
  return data as T[];
}

function parseAttributes(tag: string | null): JsonRecord {
  const attributes: JsonRecord = {};
  if (!tag) return attributes;
  for (const match of tag.matchAll(/([A-Za-z_][\w:-]*)="([^"]*)"/g)) {
    attributes[match[1]] = match[2];
  }
  return attributes;
}

function getAttributeNumber(attributes: JsonRecord, key: string): number | null {
  return asNumber(attributes[key]);
}

function roundStat(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Number(value.toFixed(6));
}

function divideStat(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return roundStat(numerator / denominator);
}

function multiplyStat(left: number | null, right: number | null): number | null {
  if (left === null || right === null) return null;
  return roundStat(left * right);
}

function firstTagAttributes(xml: string, tagName: string): JsonRecord {
  return parseAttributes(xml.match(new RegExp(`<${tagName}\\b[^>]*>`))?.[0] ?? null);
}

function nthChildAttributes(xml: string, parentName: string, childName: string, index: number): JsonRecord {
  const parent = xml.match(new RegExp(`<${parentName}>[\\s\\S]*?<\\/${parentName}>`))?.[0] ?? "";
  const children = [...parent.matchAll(new RegExp(`<${childName}\\b[^>]*\\/?>`, "g"))];
  return parseAttributes(children[index]?.[0] ?? null);
}

function rangeFromAttributes(attributes: JsonRecord): ShieldRange | null {
  const min = getAttributeNumber(attributes, "Min");
  const max = getAttributeNumber(attributes, "Max");
  return min === null || max === null ? null : { min, max };
}

function getResourceAmount(xml: string, deltaTagName: string, resource: string, amountAttribute: string): {
  max: number | null;
  minFraction: number | null;
} {
  const delta = xml.match(new RegExp(`<${deltaTagName}\\b[^>]*>[\\s\\S]*?<\\/${deltaTagName}>`))?.[0] ?? "";
  const deltaAttributes = parseAttributes(delta.match(new RegExp(`<${deltaTagName}\\b[^>]*>`))?.[0] ?? null);
  const consumption = delta.match(new RegExp(`<consumption\\s+resource="${resource}"[\\s\\S]*?<\\/consumption>`))?.[0] ?? "";
  const amountTag = consumption.match(new RegExp(`${amountAttribute}="[^"]*"`))?.[0] ?? null;
  return {
    max: getAttributeNumber(parseAttributes(amountTag ? `<x ${amountTag}>` : null), amountAttribute),
    minFraction: getAttributeNumber(deltaAttributes, "minimumConsumptionFraction"),
  };
}

function getStateBlock(xml: string, stateName: string): string {
  return xml.match(new RegExp(`<ItemResourceState\\s+name="${stateName}"[\\s\\S]*?<\\/ItemResourceState>`))?.[0] ?? "";
}

function getStateResourceAmount(xml: string, stateName: string, resource: string, amountTagName: string, amountAttribute: string): {
  max: number | null;
  minFraction: number | null;
} {
  const state = getStateBlock(xml, stateName);
  const consumption = [...state.matchAll(/<ItemResourceDeltaConsumption\b[^>]*>[\s\S]*?<\/ItemResourceDeltaConsumption>/g)]
    .map((match) => match[0])
    .find((block) => block.includes(`<consumption resource="${resource}"`)) ?? "";
  const deltaAttributes = parseAttributes(consumption.match(/<ItemResourceDeltaConsumption\b[^>]*>/)?.[0] ?? null);
  const amountAttributes = parseAttributes(consumption.match(new RegExp(`<${amountTagName}\\b[^>]*>`))?.[0] ?? null);
  return {
    max: getAttributeNumber(amountAttributes, amountAttribute),
    minFraction: getAttributeNumber(deltaAttributes, "minimumConsumptionFraction"),
  };
}

function getStateSignature(xml: string, stateName: string, tagName: string): number | null {
  const state = getStateBlock(xml, stateName);
  return getAttributeNumber(firstTagAttributes(state, tagName), "nominalSignature");
}

async function loadShieldStats(): Promise<Map<string, ShieldStatRecord>> {
  const files = (await readdir(shieldRecordsDir))
    .filter((file) => file.toLowerCase().endsWith(".xml"))
    .sort();
  const records = new Map<string, ShieldStatRecord>();

  for (const file of files) {
    const filePath = path.join(shieldRecordsDir, file);
    const xml = await readFile(filePath, "utf8");
    if (!xml.includes("SCItemShieldGeneratorParams")) continue;

    const rootAttributes = parseAttributes(xml.match(/<EntityClassDefinition\.[^>]+>/)?.[0] ?? null);
    const entityClass = asString(rootAttributes.__ref);
    if (!entityClass) continue;

    const shieldAttributes = firstTagAttributes(xml, "SCItemShieldGeneratorParams");
    const maxShieldHealth = getAttributeNumber(shieldAttributes, "MaxShieldHealth");
    const regenRate = getAttributeNumber(shieldAttributes, "MaxShieldRegen");
    const reservePoolMaxHealthRatio = getAttributeNumber(shieldAttributes, "ReservePoolMaxHealthRatio");
    const reservePoolRegenRateRatio = getAttributeNumber(shieldAttributes, "ReservePoolRegenRateRatio");
    const reservePoolRegenRate = multiplyStat(regenRate, reservePoolRegenRateRatio);
    const reservePoolMaxHealth = multiplyStat(maxShieldHealth, reservePoolMaxHealthRatio);
    const power = getResourceAmount(xml, "ItemResourceDeltaConversion", "Power", "units");
    const coolant = getResourceAmount(xml, "ItemResourceDeltaConsumption", "Coolant", "standardResourceUnits");

    records.set(entityClass, {
      entityClass,
      stats: {
        maxShieldHealth,
        regenRate,
        regenTime: divideStat(maxShieldHealth, regenRate),
        damageRegenDelay: getAttributeNumber(shieldAttributes, "DamagedRegenDelay"),
        downedRegenDelay: getAttributeNumber(shieldAttributes, "DownedRegenDelay"),
        reservePoolRegenRate,
        reservePoolRegenTime: divideStat(reservePoolMaxHealth, reservePoolRegenRate),
        physicalAbsorption: rangeFromAttributes(nthChildAttributes(xml, "ShieldAbsorption", "SShieldAbsorption", 0)),
        physicalResistance: rangeFromAttributes(nthChildAttributes(xml, "ShieldResistance", "SShieldResistance", 0)),
        distortionResistance: rangeFromAttributes(nthChildAttributes(xml, "ShieldResistance", "SShieldResistance", 2)),
        powerUsageMin: multiplyStat(power.max, power.minFraction),
        powerUsageMax: power.max,
        coolantUsageMin: multiplyStat(coolant.max, coolant.minFraction),
        coolantUsageMax: coolant.max,
      },
      source: {
        file: filePath,
        fields: [
          "stats.shield.maxShieldHealth <- SCItemShieldGeneratorParams@MaxShieldHealth (safe; parse number)",
          "stats.shield.regenRate <- SCItemShieldGeneratorParams@MaxShieldRegen (safe; parse number)",
          "stats.shield.regenTime <- MaxShieldHealth / MaxShieldRegen (caution; derived)",
          "stats.shield.damageRegenDelay <- SCItemShieldGeneratorParams@DamagedRegenDelay (safe; parse number)",
          "stats.shield.downedRegenDelay <- SCItemShieldGeneratorParams@DownedRegenDelay (safe; parse number)",
          "stats.shield.reservePoolRegenRate <- MaxShieldRegen * ReservePoolRegenRateRatio (caution; derived)",
          "stats.shield.reservePoolRegenTime <- MaxShieldHealth * ReservePoolMaxHealthRatio / reservePoolRegenRate (caution; derived)",
          "stats.shield.physicalAbsorption <- ShieldAbsorption/SShieldAbsorption[0] (caution; positional damage-type mapping)",
          "stats.shield.physicalResistance <- ShieldResistance/SShieldResistance[0] (caution; positional damage-type mapping)",
          "stats.shield.distortionResistance <- ShieldResistance/SShieldResistance[2] (caution; positional damage-type mapping)",
          "stats.shield.powerUsageMin <- ItemResourceDeltaConversion Power units * minimumConsumptionFraction (caution; derived)",
          "stats.shield.powerUsageMax <- ItemResourceDeltaConversion Power units (safe; parse number)",
          "stats.shield.coolantUsageMin <- ItemResourceDeltaConsumption Coolant standardResourceUnits * minimumConsumptionFraction (caution; derived)",
          "stats.shield.coolantUsageMax <- ItemResourceDeltaConsumption Coolant standardResourceUnits (safe; parse number)",
        ],
        warnings: [
          "shield regen time and reserve pool fields are derived from audited XML ratios",
          "shield resistance and absorption use audited positional child-node mapping, not generic durability resistances",
          "shield min power/coolant usage is derived from minimumConsumptionFraction and rounded to 6 decimals",
        ],
      },
    });
  }

  return records;
}

async function loadQuantumDriveStats(): Promise<Map<string, QuantumDriveStatRecord>> {
  const files = (await readdir(quantumDriveRecordsDir))
    .filter((file) => file.toLowerCase().endsWith(".xml"))
    .sort();
  const records = new Map<string, QuantumDriveStatRecord>();

  for (const file of files) {
    const filePath = path.join(quantumDriveRecordsDir, file);
    const xml = await readFile(filePath, "utf8");
    if (!xml.includes("SCItemQuantumDriveParams")) continue;

    const rootAttributes = parseAttributes(xml.match(/<EntityClassDefinition\.[^>]+>/)?.[0] ?? null);
    const entityClass = asString(rootAttributes.__ref);
    if (!entityClass) continue;

    const driveAttributes = firstTagAttributes(xml, "SCItemQuantumDriveParams");
    const normalJumpAttributes = firstTagAttributes(xml, "params");
    const splineJumpAttributes = firstTagAttributes(xml, "splineJumpParams");
    const power = getStateResourceAmount(xml, "Online", "Power", "SStandardResourceUnit", "standardResourceUnits");
    const coolant = getStateResourceAmount(xml, "Online", "Coolant", "SStandardResourceUnit", "standardResourceUnits");
    const quantumFuel = getStateResourceAmount(xml, "Travelling", "QuantumFuel", "SMicroResourceUnit", "microResourceUnits");

    records.set(entityClass, {
      entityClass,
      stats: {
        fuelEfficiency: null,
        quantumFuelRequirement: getAttributeNumber(driveAttributes, "quantumFuelRequirement"),
        quantumFuelConsumptionRate: quantumFuel.max,
        normalJumpSpeed: getAttributeNumber(normalJumpAttributes, "driveSpeed"),
        splineJumpSpeed: getAttributeNumber(splineJumpAttributes, "driveSpeed"),
        spoolTime: getAttributeNumber(normalJumpAttributes, "spoolUpTime"),
        cooldown: getAttributeNumber(normalJumpAttributes, "cooldownTime"),
        splineCooldown: getAttributeNumber(splineJumpAttributes, "cooldownTime"),
        calibrationRequirementMin: getAttributeNumber(normalJumpAttributes, "minCalibrationRequirement"),
        calibrationRequirementMax: getAttributeNumber(normalJumpAttributes, "maxCalibrationRequirement"),
        calibrationAngleMin: getAttributeNumber(normalJumpAttributes, "calibrationProcessAngleLimit"),
        calibrationAngleMax: getAttributeNumber(normalJumpAttributes, "calibrationWarningAngleLimit"),
        calibrationDelay: getAttributeNumber(normalJumpAttributes, "calibrationDelayInSeconds"),
        calibrationRate: getAttributeNumber(normalJumpAttributes, "calibrationRate"),
        stageOneAcceleration: getAttributeNumber(normalJumpAttributes, "stageOneAccelRate"),
        stageTwoAcceleration: getAttributeNumber(normalJumpAttributes, "stageTwoAccelRate"),
        engageSpeed: getAttributeNumber(normalJumpAttributes, "engageSpeed"),
        interdictionEffectTime: getAttributeNumber(normalJumpAttributes, "interdictionEffectTime"),
        powerUsageMin: multiplyStat(power.max, power.minFraction),
        powerUsageMax: power.max,
        coolantUsageMin: multiplyStat(coolant.max, coolant.minFraction),
        coolantUsageMax: coolant.max,
        onlineEmSignature: getStateSignature(xml, "Online", "EMSignature"),
        onlineIrSignature: getStateSignature(xml, "Online", "IRSignature"),
        travellingEmSignature: getStateSignature(xml, "Travelling", "EMSignature"),
        travellingIrSignature: getStateSignature(xml, "Travelling", "IRSignature"),
      },
      source: {
        file: filePath,
        fields: [
          "stats.quantumDrive.fuelEfficiency remains null (no direct foundry XML field identified)",
          "stats.quantumDrive.quantumFuelRequirement <- SCItemQuantumDriveParams@quantumFuelRequirement (safe; parse number)",
          "stats.quantumDrive.quantumFuelConsumptionRate <- ItemResourceState[name=Travelling] QuantumFuel SMicroResourceUnit@microResourceUnits (safe; parse number)",
          "stats.quantumDrive.normalJumpSpeed <- SCItemQuantumDriveParams/params@driveSpeed (safe; parse number)",
          "stats.quantumDrive.splineJumpSpeed <- SCItemQuantumDriveParams/splineJumpParams@driveSpeed (safe; parse number)",
          "stats.quantumDrive.spoolTime <- SCItemQuantumDriveParams/params@spoolUpTime (safe; parse number)",
          "stats.quantumDrive.cooldown <- SCItemQuantumDriveParams/params@cooldownTime (safe; parse number)",
          "stats.quantumDrive.splineCooldown <- SCItemQuantumDriveParams/splineJumpParams@cooldownTime (safe; parse number)",
          "stats.quantumDrive.calibrationRequirementMin <- SCItemQuantumDriveParams/params@minCalibrationRequirement (safe; parse number)",
          "stats.quantumDrive.calibrationRequirementMax <- SCItemQuantumDriveParams/params@maxCalibrationRequirement (safe; parse number)",
          "stats.quantumDrive.calibrationAngleMin <- SCItemQuantumDriveParams/params@calibrationProcessAngleLimit (caution; mapped as inner/process angle)",
          "stats.quantumDrive.calibrationAngleMax <- SCItemQuantumDriveParams/params@calibrationWarningAngleLimit (caution; mapped as outer/warning angle)",
          "stats.quantumDrive.calibrationDelay <- SCItemQuantumDriveParams/params@calibrationDelayInSeconds (safe; parse number)",
          "stats.quantumDrive.calibrationRate <- SCItemQuantumDriveParams/params@calibrationRate (safe; parse number)",
          "stats.quantumDrive.stageOneAcceleration <- SCItemQuantumDriveParams/params@stageOneAccelRate (safe; parse number)",
          "stats.quantumDrive.stageTwoAcceleration <- SCItemQuantumDriveParams/params@stageTwoAccelRate (safe; parse number)",
          "stats.quantumDrive.engageSpeed <- SCItemQuantumDriveParams/params@engageSpeed (safe; parse number)",
          "stats.quantumDrive.interdictionEffectTime <- SCItemQuantumDriveParams/params@interdictionEffectTime (safe; parse number)",
          "stats.quantumDrive.powerUsageMin <- ItemResourceState[name=Online] Power standardResourceUnits * minimumConsumptionFraction (caution; derived)",
          "stats.quantumDrive.powerUsageMax <- ItemResourceState[name=Online] Power standardResourceUnits (safe; parse number)",
          "stats.quantumDrive.coolantUsageMin <- ItemResourceState[name=Online] Coolant standardResourceUnits * minimumConsumptionFraction (caution; derived)",
          "stats.quantumDrive.coolantUsageMax <- ItemResourceState[name=Online] Coolant standardResourceUnits (safe; parse number)",
          "stats.quantumDrive.onlineEmSignature <- ItemResourceState[name=Online] EMSignature@nominalSignature (safe; parse number)",
          "stats.quantumDrive.onlineIrSignature <- ItemResourceState[name=Online] IRSignature@nominalSignature (safe; parse number)",
          "stats.quantumDrive.travellingEmSignature <- ItemResourceState[name=Travelling] EMSignature@nominalSignature (safe; parse number)",
          "stats.quantumDrive.travellingIrSignature <- ItemResourceState[name=Travelling] IRSignature@nominalSignature (safe; parse number)",
        ],
        warnings: [
          "no direct fuelEfficiency field was found in audited quantum drive XML; field remains null rather than inferred",
          "calibration angle min/max use audited process/warning angle attributes because the XML does not name them min/max",
          "quantum drive min power/coolant usage is derived from minimumConsumptionFraction and rounded to 6 decimals",
          "emission fields are copied from quantum drive ItemResourceState signatureParams, separate from generic baseStats",
        ],
      },
    });
  }

  return records;
}

function getNestedNumber(value: unknown, pathParts: string[]): number | null {
  let current = value;
  for (const part of pathParts) {
    if (!isRecord(current)) return null;
    current = current[part];
  }
  return asNumber(current);
}

function normalizeMaterials(materials: SourceMaterial[] | undefined): IndexMaterial[] {
  return (materials ?? []).flatMap((material) => {
    const name = asString(material.materialName);
    const quantity = asNumber(material.quantity);
    if (!name || quantity === null) return [];
    const costId = asString(material.costId);
    const materialId = asString(material.materialId) ?? costId;
    return [{
      slot: asString(material.slot ?? material.slotDisplayName),
      name,
      quantity,
      unit: asString(material.unitType ?? material.unit),
      materialId,
      costId,
      materialKey: asString(material.materialKey),
      minQuality: asNumber(material.minQuality),
    }];
  });
}

function buildPrimaryMetrics(record: Pick<ComponentCardIndexRecord, "size" | "grade" | "class" | "craftTimeSeconds" | "entityClass">): CardMetric[] {
  const metrics: CardMetric[] = [];
  const craftTime = formatCraftTime(record.craftTimeSeconds);
  if (record.size !== null) metrics.push({ label: "Size", value: `S${record.size}` });
  if (record.grade) metrics.push({ label: "Grade", value: record.grade });
  if (record.class) metrics.push({ label: "Class", value: titleCase(record.class) });
  if (craftTime) metrics.push({ label: "Craft", value: craftTime });
  if (record.entityClass) metrics.push({ label: "Entity", value: record.entityClass.slice(0, 8) });
  return metrics.slice(0, 5);
}

function buildGenericStats(baseStats: unknown): ComponentCardIndexRecord["stats"]["generic"] {
  return {
    mass: getNestedNumber(baseStats, ["mass"]),
    health: getNestedNumber(baseStats, ["health"]),
    emSignature: getNestedNumber(baseStats, ["emSignature", "nominalSignature"]),
    irSignature: getNestedNumber(baseStats, ["irSignature", "nominalSignature"]),
    distortionMaximum: getNestedNumber(baseStats, ["distortion", "maximum"]),
  };
}

function genericSecondary(generic: ComponentCardIndexRecord["stats"]["generic"]): CardMetric[] {
  const metrics: CardMetric[] = [];
  if (generic.mass !== null) metrics.push({ label: "Generic mass", value: formatNumber(generic.mass), field: "baseStats.mass", confidence: "safe" });
  if (generic.health !== null) metrics.push({ label: "Generic health", value: formatNumber(generic.health), field: "baseStats.health", confidence: "safe" });
  if (generic.emSignature !== null) metrics.push({ label: "Generic EM", value: formatNumber(generic.emSignature), field: "baseStats.emSignature.nominalSignature", confidence: "safe" });
  if (generic.irSignature !== null) metrics.push({ label: "Generic IR", value: formatNumber(generic.irSignature), field: "baseStats.irSignature.nominalSignature", confidence: "safe" });
  return metrics;
}

function modifierProperties(modifiers: JsonRecord[] | undefined): string[] {
  return unique((modifiers ?? []).map((modifier) => asString(modifier.gameplayProperty)));
}

function formatModifierProperty(raw: string): string {
  return raw.replace(/^GPP_/, "").replace(/_/g, " ");
}

function familyCounts(records: FpsBlueprint[]): Map<string, number> {
  const byFamily = new Map<string, Set<string>>();
  for (const record of records) {
    const familyKey = asString(record.familyKey);
    const id = asString(record.blueprintGuid ?? record.id);
    if (!familyKey || !id) continue;
    const ids = byFamily.get(familyKey) ?? new Set<string>();
    ids.add(id);
    byFamily.set(familyKey, ids);
  }
  return new Map([...byFamily.entries()].map(([key, ids]) => [key, ids.size]));
}

function buildVehicleRecord(
  item: VehicleBlueprint,
  shieldStatsByEntityClass: Map<string, ShieldStatRecord>,
  quantumDriveStatsByEntityClass: Map<string, QuantumDriveStatRecord>,
): ComponentCardIndexRecord | null {
  const id = asString(item.blueprintGuid);
  const name = asString(item.displayName);
  const type = asString(item.componentType);
  const craftTimeSeconds = asNumber(item.craftTimeSeconds);
  if (!id || !name || !type || craftTimeSeconds === null) return null;

  const materials = normalizeMaterials(item.materials);
  const size = asNumber(item.size);
  const grade = asString(item.grade);
  const className = asString(item.class);
  const entityClass = asString(item.entityClass);
  const rewardPools = item.rewardPools ?? [];
  const sourcePools = unique(rewardPools.map((pool) => asString(pool.poolGuid)));
  const generic = buildGenericStats(item.baseStats);
  const coolantGeneration = getNestedNumber(item.baseStats, ["resources", "generation", "Coolant"]);
  const powerDraw = getNestedNumber(item.baseStats, ["resources", "consumption", "Power"]);
  const shieldRecord = type === "shield" && entityClass ? shieldStatsByEntityClass.get(entityClass) ?? null : null;
  const shieldStats = shieldRecord?.stats ?? null;
  const quantumDriveRecord = type === "quantumdrive" && entityClass ? quantumDriveStatsByEntityClass.get(entityClass) ?? null : null;
  const quantumDriveStats = quantumDriveRecord?.stats ?? null;
  const modifierTokens = modifierProperties(item.qualityModifiers);
  const manufacturerGuid = asString(item.manufacturerGuid);
  const warnings = unique([
    manufacturerGuid ? "manufacturerGuid has no confirmed local display-name lookup" : null,
    ...modifierTokens.length ? ["quality modifier properties are indexed as tokens only, not final stats"] : [],
  ]);

  const baseFields = [
    "blueprintGuid",
    "displayName",
    "componentType",
    "size",
    "grade",
    "class",
    "manufacturerGuid",
    "entityClass",
    "craftTimeSeconds",
    "materials",
    "baseStats",
    "rewardPools",
  ];

  const recordBase = {
    id,
    name,
    kind: "vehicle" as const,
    category: "vehicle",
    type,
    typeLabel: VEHICLE_TYPE_LABELS[type] ?? titleCase(type),
    size,
    grade,
    class: className,
    manufacturerGuid,
    manufacturer: null,
    family: null,
    familyKey: null,
    variants: [],
    variantName: null,
    entityClass,
    craftTimeSeconds,
    materials,
  };

  const secondary: CardMetric[] = [];
  if (type === "cooler" && coolantGeneration !== null) {
    secondary.push({ label: "Coolant generation", value: formatNumber(coolantGeneration), field: "baseStats.resources.generation.Coolant", confidence: "caution" });
  }
  if (type === "cooler" && powerDraw !== null) {
    secondary.push({ label: "Power draw", value: formatNumber(powerDraw), field: "baseStats.resources.consumption.Power", confidence: "safe" });
  }
  if (type === "shield" && shieldStats) {
    if (shieldStats.maxShieldHealth !== null) secondary.push({ label: "Shield HP", value: formatNumber(shieldStats.maxShieldHealth), field: "SCItemShieldGeneratorParams.MaxShieldHealth", confidence: "safe" });
    if (shieldStats.regenRate !== null) secondary.push({ label: "Regen", value: `${formatNumber(shieldStats.regenRate)}/s`, field: "SCItemShieldGeneratorParams.MaxShieldRegen", confidence: "safe" });
    if (shieldStats.damageRegenDelay !== null) secondary.push({ label: "Regen delay", value: `${formatNumber(shieldStats.damageRegenDelay)}s`, field: "SCItemShieldGeneratorParams.DamagedRegenDelay", confidence: "safe" });
    if (shieldStats.physicalResistance !== null) secondary.push({ label: "Resistance", value: formatRangePercent(shieldStats.physicalResistance), field: "ShieldResistance.SShieldResistance[0]", confidence: "caution" });
    if (shieldStats.physicalAbsorption !== null) secondary.push({ label: "Absorption", value: formatRangePercent(shieldStats.physicalAbsorption), field: "ShieldAbsorption.SShieldAbsorption[0]", confidence: "caution" });
    if (shieldStats.powerUsageMax !== null) secondary.push({ label: "Power", value: formatNumber(shieldStats.powerUsageMax), field: "ItemResourceDeltaConversion.consumption.Power", confidence: "safe" });
    if (shieldStats.coolantUsageMax !== null) secondary.push({ label: "Coolant", value: formatNumber(shieldStats.coolantUsageMax), field: "ItemResourceDeltaConsumption.consumption.Coolant", confidence: "safe" });
  }
  secondary.push(...genericSecondary(generic));

  const { searchText, searchTokens } = buildSearchText([
    id,
    name,
    type,
    recordBase.typeLabel,
    recordBase.kind,
    recordBase.category,
    size !== null ? `s${size}` : null,
    size,
    grade,
    className,
    manufacturerGuid,
    entityClass,
    asString(item.blueprintName),
    ...materials.flatMap((material) => [material.name, material.materialKey, material.materialId, material.costId]),
    ...modifierTokens,
    ...rewardPools.map((pool) => asString(pool.displayName)),
  ]);

  return {
    ...recordBase,
    searchText,
    searchTokens,
    facets: {
      kind: "vehicle",
      category: "vehicle",
      type: recordBase.typeLabel.toLowerCase(),
      size: size === null ? null : String(size),
      grade,
      class: className,
      materials: unique(materials.map((material) => material.costId ?? material.materialId)),
      materialNames: unique(materials.map((material) => material.name.toLowerCase())),
      weaponClass: null,
      armorSlot: null,
      armorWeight: null,
      ammoClass: null,
      sourcePools,
    },
    sort: {
      name: name.toLowerCase(),
      type: recordBase.typeLabel.toLowerCase(),
      craftTimeSeconds,
      size,
      gradeRank: grade ? GRADE_RANK[grade.toUpperCase()] ?? null : null,
      materialCount: materials.length,
      sourceCount: rewardPools.length,
      ...(coolantGeneration !== null ? { coolantGeneration } : {}),
      ...(powerDraw !== null ? { powerDraw } : {}),
    },
    card: {
      primary: buildPrimaryMetrics(recordBase),
      secondary: secondary.slice(0, 5),
      materialsPreview: materials.slice(0, 3).map((material) => ({
        name: material.name,
        quantity: material.quantity,
        unit: material.unit,
      })),
      badges: type === "powerplant" ? modifierTokens.map(formatModifierProperty).slice(0, 3) : [],
    },
    stats: {
      generic,
      cooler: type === "cooler" ? { coolantGeneration, powerDraw } : null,
      powerPlant: null,
      quantumDrive: type === "quantumdrive" ? quantumDriveStats : null,
      shield: type === "shield" ? shieldStats : null,
      shipWeapon: null,
      radar: null,
      tractorBeam: null,
      fpsWeapon: null,
      fpsArmor: null,
      fpsAmmo: null,
    },
    source: {
      files: unique(["public/api/crafting/blueprints.json", shieldRecord?.source.file, quantumDriveRecord?.source.file]),
      fields: [...baseFields, ...(shieldRecord?.source.fields ?? []), ...(quantumDriveRecord?.source.fields ?? [])],
      warnings: unique([
        ...warnings,
        type === "shield" && !shieldRecord ? "shield foundry XML record was not joined; stats.shield remains null" : null,
        type === "quantumdrive" && !quantumDriveRecord ? "quantum drive foundry XML record was not joined; stats.quantumDrive remains null" : null,
        ...(shieldRecord?.source.warnings ?? []),
        ...(quantumDriveRecord?.source.warnings ?? []),
      ]),
    },
  };
}

function buildFpsRecord(item: FpsBlueprint, variantCounts: Map<string, number>): ComponentCardIndexRecord | null {
  const id = asString(item.blueprintGuid ?? item.id);
  const name = asString(item.displayName ?? item.familyDisplayName ?? item.baseName ?? item.blueprintName);
  const type = asString(item.fpsCategory ?? item.sourceBranch ?? item.category);
  const craftTimeSeconds = asNumber(item.craftTimeSeconds);
  if (!id || !name || !type || craftTimeSeconds === null) return null;

  const materials = normalizeMaterials(item.materialRequirements ?? item.materials);
  const weaponClass = asString(item.weaponClass);
  const armorSlot = asString(item.armorSlot);
  const armorWeight = asString(item.armorWeight);
  const ammoClass = asString(item.ammoClass);
  const familyKey = asString(item.familyKey);
  const family = asString(item.familyDisplayName ?? item.baseName ?? item.armorFamily);
  const variantName = asString(item.variantName);
  const variantCount = familyKey ? variantCounts.get(familyKey) ?? 1 : 0;
  const variants = familyKey && variantCount > 0 ? [familyKey] : [];
  const entityClass = asString(item.entityClass);
  const modifierTokens = modifierProperties(item.qualityModifiers);
  const warnings = unique([
    ...modifierTokens.length ? ["quality modifier properties are indexed as tokens only, not final stats"] : [],
    type === "ammo" ? "ammo compatibility and capacity are not normalized fields in current local data" : null,
  ]);

  const recordBase = {
    id,
    name,
    kind: "fps" as const,
    category: "fps",
    type,
    typeLabel: FPS_TYPE_LABELS[type.toLowerCase()] ?? titleCase(type),
    size: null,
    grade: null,
    class: null,
    manufacturerGuid: null,
    manufacturer: null,
    family,
    familyKey,
    variants,
    variantName,
    entityClass,
    craftTimeSeconds,
    materials,
  };

  const secondary: CardMetric[] = [];
  if (weaponClass) secondary.push({ label: "Weapon class", value: titleCase(weaponClass), field: "weaponClass", confidence: "safe" });
  if (armorSlot) secondary.push({ label: "Armor slot", value: titleCase(armorSlot), field: "armorSlot", confidence: "safe" });
  if (armorWeight) secondary.push({ label: "Armor weight", value: titleCase(armorWeight), field: "armorWeight", confidence: "safe" });
  if (ammoClass) secondary.push({ label: "Ammo class", value: titleCase(ammoClass), field: "ammoClass", confidence: "safe" });
  if (family) secondary.push({ label: type === "armor" ? "Armor family" : "Family", value: family, field: "familyDisplayName", confidence: "safe" });
  if (variantName) secondary.push({ label: "Variant", value: variantName, field: "variantName", confidence: "safe" });
  if (variantCount > 1) secondary.push({ label: "Variants", value: String(variantCount), field: "familyKey", confidence: "safe" });

  const { searchText, searchTokens } = buildSearchText([
    id,
    name,
    type,
    recordBase.typeLabel,
    recordBase.kind,
    recordBase.category,
    weaponClass,
    armorSlot,
    armorWeight,
    ammoClass,
    family,
    familyKey,
    variantName,
    entityClass,
    asString(item.blueprintName),
    asString(item.sourceRelativePath),
    ...materials.flatMap((material) => [material.name, material.materialKey, material.materialId, material.costId]),
    ...modifierTokens,
  ]);

  return {
    ...recordBase,
    searchText,
    searchTokens,
    facets: {
      kind: "fps",
      category: "fps",
      type,
      size: null,
      grade: null,
      class: null,
      materials: unique(materials.map((material) => material.costId ?? material.materialId)),
      materialNames: unique(materials.map((material) => material.name.toLowerCase())),
      weaponClass,
      armorSlot,
      armorWeight,
      ammoClass,
      sourcePools: [],
    },
    sort: {
      name: name.toLowerCase(),
      type,
      craftTimeSeconds,
      size: null,
      gradeRank: null,
      materialCount: materials.length,
      sourceCount: 0,
    },
    card: {
      primary: buildPrimaryMetrics(recordBase),
      secondary: secondary.slice(0, 5),
      materialsPreview: materials.slice(0, 3).map((material) => ({
        name: material.name,
        quantity: material.quantity,
        unit: material.unit,
      })),
      badges: modifierTokens.map(formatModifierProperty).slice(0, 3),
    },
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
      fpsWeapon: type === "weapons" ? { weaponClass, family, variantName, variantCount } : null,
      fpsArmor: type === "armor" ? { armorSlot, armorWeight, family, variantName, variantCount } : null,
      fpsAmmo: type === "ammo" ? { ammoClass, family, variantName, variantCount } : null,
    },
    source: {
      files: ["public/api/crafting/fps/fps_blueprints.json"],
      fields: [
        "blueprintGuid",
        "displayName",
        "fpsCategory",
        "weaponClass",
        "armorSlot",
        "armorWeight",
        "ammoClass",
        "familyKey",
        "familyDisplayName",
        "variantName",
        "entityClass",
        "craftTimeSeconds",
        "materialRequirements",
      ],
      warnings,
    },
  };
}

function buildFacetSummary(records: ComponentCardIndexRecord[]) {
  const facetValue = (label: string, value: string) => ({ value, label });
  return {
    types: [...new Map(records.map((record) => [record.type, facetValue(record.typeLabel, record.type)])).values()],
    materials: [...new Map(records.flatMap((record) => record.materials.map((material) => [
      material.costId ?? material.materialId ?? material.name,
      facetValue(material.name, material.costId ?? material.materialId ?? material.name),
    ]))).values()],
    grades: unique(records.map((record) => record.grade)).sort(),
    classes: unique(records.map((record) => record.class)).sort(),
    weaponClasses: unique(records.map((record) => record.facets.weaponClass)).sort(),
    armorSlots: unique(records.map((record) => record.facets.armorSlot)).sort(),
    armorWeights: unique(records.map((record) => record.facets.armorWeight)).sort(),
    ammoClasses: unique(records.map((record) => record.facets.ammoClass)).sort(),
  };
}

function countPopulatedShieldFields(records: ComponentCardIndexRecord[]): Record<keyof ShieldStats, number> {
  const counts: Record<keyof ShieldStats, number> = {
    maxShieldHealth: 0,
    regenRate: 0,
    regenTime: 0,
    damageRegenDelay: 0,
    downedRegenDelay: 0,
    reservePoolRegenRate: 0,
    reservePoolRegenTime: 0,
    physicalAbsorption: 0,
    physicalResistance: 0,
    distortionResistance: 0,
    powerUsageMin: 0,
    powerUsageMax: 0,
    coolantUsageMin: 0,
    coolantUsageMax: 0,
  };
  for (const record of records) {
    if (!record.stats.shield) continue;
    for (const key of Object.keys(counts) as Array<keyof ShieldStats>) {
      if (record.stats.shield[key] !== null) counts[key] += 1;
    }
  }
  return counts;
}

function countPopulatedQuantumDriveFields(records: ComponentCardIndexRecord[]): Record<keyof QuantumDriveStats, number> {
  const counts: Record<keyof QuantumDriveStats, number> = {
    fuelEfficiency: 0,
    quantumFuelRequirement: 0,
    quantumFuelConsumptionRate: 0,
    normalJumpSpeed: 0,
    splineJumpSpeed: 0,
    spoolTime: 0,
    cooldown: 0,
    splineCooldown: 0,
    calibrationRequirementMin: 0,
    calibrationRequirementMax: 0,
    calibrationAngleMin: 0,
    calibrationAngleMax: 0,
    calibrationDelay: 0,
    calibrationRate: 0,
    stageOneAcceleration: 0,
    stageTwoAcceleration: 0,
    engageSpeed: 0,
    interdictionEffectTime: 0,
    powerUsageMin: 0,
    powerUsageMax: 0,
    coolantUsageMin: 0,
    coolantUsageMax: 0,
    onlineEmSignature: 0,
    onlineIrSignature: 0,
    travellingEmSignature: 0,
    travellingIrSignature: 0,
  };
  for (const record of records) {
    if (!record.stats.quantumDrive) continue;
    for (const key of Object.keys(counts) as Array<keyof QuantumDriveStats>) {
      if (record.stats.quantumDrive[key] !== null) counts[key] += 1;
    }
  }
  return counts;
}

function validate(
  records: ComponentCardIndexRecord[],
  expectedCount: number,
  shieldStatsByEntityClass: Map<string, ShieldStatRecord>,
  quantumDriveStatsByEntityClass: Map<string, QuantumDriveStatRecord>,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const vehicleCount = records.filter((record) => record.kind === "vehicle").length;
  const fpsCount = records.filter((record) => record.kind === "fps").length;
  const shieldRecords = records.filter((record) => record.type === "shield");
  const joinedShieldRecords = shieldRecords.filter((record) => record.entityClass && shieldStatsByEntityClass.has(record.entityClass));
  const quantumDriveRecords = records.filter((record) => record.type === "quantumdrive");
  const joinedQuantumDriveRecords = quantumDriveRecords.filter((record) => record.entityClass && quantumDriveStatsByEntityClass.has(record.entityClass));

  if (records.length !== expectedCount) {
    errors.push(`record count mismatch: expected ${expectedCount}, generated ${records.length}`);
  }
  if (records.length !== 1553) errors.push(`current browser count changed: expected 1553, generated ${records.length}`);
  if (vehicleCount !== 471) errors.push(`vehicle count changed: expected 471, generated ${vehicleCount}`);
  if (fpsCount !== 1082) errors.push(`fps count changed: expected 1082, generated ${fpsCount}`);
  if (shieldRecords.length !== 62) errors.push(`shield craftable count changed: expected 62, generated ${shieldRecords.length}`);
  if (joinedShieldRecords.length !== 62) errors.push(`shield foundry join count changed: expected 62, joined ${joinedShieldRecords.length}`);
  if (quantumDriveRecords.length !== 57) errors.push(`quantum drive craftable count changed: expected 57, generated ${quantumDriveRecords.length}`);
  if (joinedQuantumDriveRecords.length !== 57) errors.push(`quantum drive foundry join count changed: expected 57, joined ${joinedQuantumDriveRecords.length}`);
  if (!shieldRecords.some((record) => record.stats.shield?.maxShieldHealth !== null)) errors.push("no shield maxShieldHealth values populated from foundry XML");
  if (!shieldRecords.some((record) => record.stats.shield?.regenRate !== null)) errors.push("no shield regenRate values populated from foundry XML");
  if (!quantumDriveRecords.some((record) => record.stats.quantumDrive?.normalJumpSpeed !== null)) errors.push("no quantum drive normalJumpSpeed values populated from foundry XML");
  if (!quantumDriveRecords.some((record) => record.stats.quantumDrive?.quantumFuelRequirement !== null)) errors.push("no quantum drive quantumFuelRequirement values populated from foundry XML");

  for (const record of records) {
    if (!record.id) errors.push(`record missing id: ${record.name}`);
    if (!record.name) errors.push(`record missing name: ${record.id}`);
    if (!record.kind) errors.push(`record missing kind: ${record.id}`);
    if (!record.type) errors.push(`record missing type: ${record.id}`);
    if (!Number.isFinite(record.craftTimeSeconds)) errors.push(`record missing numeric craftTimeSeconds: ${record.id}`);
    if (ids.has(record.id)) errors.push(`duplicate id: ${record.id}`);
    ids.add(record.id);
    if (record.id === record.name) errors.push(`record uses display name as id: ${record.id}`);
    if (record.manufacturer !== null) errors.push(`manufacturer display name should remain null without lookup: ${record.id}`);
    for (const [field, value] of Object.entries({
      size: record.size,
      grade: record.grade,
      class: record.class,
      manufacturer: record.manufacturer,
      family: record.family,
      familyKey: record.familyKey,
      variantName: record.variantName,
      entityClass: record.entityClass,
    })) {
      if (value === "Unknown" || value === "N/A" || value === "") {
        errors.push(`missing ${field} should be null, not a fake string: ${record.id}`);
      }
    }

    for (const material of record.materials) {
      if (!Number.isFinite(material.quantity)) {
        errors.push(`material quantity is not numeric: ${record.id} / ${material.name}`);
      }
      for (const [field, value] of Object.entries(material)) {
        if (value === "Unknown" || value === "N/A" || value === "") {
          errors.push(`missing material ${field} should be null, not a fake string: ${record.id} / ${material.name}`);
        }
      }
    }

    const genericValues = record.stats.generic;
    const categoryStats = [
      record.stats.cooler,
      record.stats.quantumDrive,
      record.stats.shield,
      record.stats.fpsWeapon,
      record.stats.fpsArmor,
      record.stats.fpsAmmo,
    ].filter(Boolean);
    if (!isRecord(genericValues)) errors.push(`generic stats missing object: ${record.id}`);
    if (record.type !== "cooler" && record.stats.cooler !== null) errors.push(`cooler stats populated on non-cooler: ${record.id}`);
    if (record.type !== "quantumdrive" && record.stats.quantumDrive !== null) errors.push(`quantumDrive stats populated on non-quantumdrive: ${record.id}`);
    if (record.type !== "shield" && record.stats.shield !== null) errors.push(`shield stats populated on non-shield: ${record.id}`);
    if (record.type === "quantumdrive" && record.stats.quantumDrive !== null) {
      if (!record.source.fields.some((field) => field.includes("SCItemQuantumDriveParams/params@driveSpeed"))) {
        errors.push(`quantum drive normalJumpSpeed lacks foundry XML source metadata: ${record.id}`);
      }
      if (record.stats.quantumDrive.fuelEfficiency !== null) {
        errors.push(`quantum drive fuelEfficiency should remain null until a direct source field is confirmed: ${record.id}`);
      }
    }
    if (record.type === "shield" && record.stats.shield !== null) {
      if (!record.source.fields.some((field) => field.includes("SCItemShieldGeneratorParams@MaxShieldHealth"))) {
        errors.push(`shield maxShieldHealth lacks foundry XML source metadata: ${record.id}`);
      }
    }
    if (record.type !== "weapons" && record.stats.fpsWeapon !== null) errors.push(`fpsWeapon stats populated on non-FPS-weapon: ${record.id}`);
    if (record.type !== "armor" && record.stats.fpsArmor !== null) errors.push(`fpsArmor stats populated on non-FPS-armor: ${record.id}`);
    if (record.type !== "ammo" && record.stats.fpsAmmo !== null) errors.push(`fpsAmmo stats populated on non-FPS-ammo: ${record.id}`);
    if (categoryStats.some((stats) => stats === genericValues)) errors.push(`generic stats object reused as category stats: ${record.id}`);
  }

  return errors;
}

async function main() {
  const vehicleBlueprints = await readJsonArray<VehicleBlueprint>(vehiclePath);
  const fpsBlueprints = await readJsonArray<FpsBlueprint>(fpsPath);
  const shieldStatsByEntityClass = await loadShieldStats();
  const quantumDriveStatsByEntityClass = await loadQuantumDriveStats();
  const variantCounts = familyCounts(fpsBlueprints);

  const records = [
    ...vehicleBlueprints.flatMap((item) => {
      const record = buildVehicleRecord(item, shieldStatsByEntityClass, quantumDriveStatsByEntityClass);
      return record ? [record] : [];
    }),
    ...fpsBlueprints.flatMap((item) => {
      const record = buildFpsRecord(item, variantCounts);
      return record ? [record] : [];
    }),
  ].sort((a, b) => a.sort.type.localeCompare(b.sort.type) || a.sort.name.localeCompare(b.sort.name));

  const expectedCount = vehicleBlueprints.length + fpsBlueprints.length;
  const errors = validate(records, expectedCount, shieldStatsByEntityClass, quantumDriveStatsByEntityClass);
  if (errors.length) {
    console.error("component card index validation failed:");
    for (const error of errors.slice(0, 50)) console.error(`- ${error}`);
    if (errors.length > 50) console.error(`...and ${errors.length - 50} more`);
    process.exit(1);
  }

  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceRecordCount: {
      vehicle: vehicleBlueprints.length,
      fps: fpsBlueprints.length,
      total: expectedCount,
    },
    records,
    facets: buildFacetSummary(records),
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload)}\n`, "utf8");

  const bytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  console.log(`component card index generated: ${path.relative(root, outputPath)}`);
  console.log(`records: ${records.length} (vehicle ${vehicleBlueprints.length}, fps ${fpsBlueprints.length})`);
  console.log(`shield foundry records loaded: ${shieldStatsByEntityClass.size}`);
  console.log(`shield records joined: ${records.filter((record) => record.type === "shield" && record.stats.shield).length}`);
  console.log(`shield populated fields: ${JSON.stringify(countPopulatedShieldFields(records))}`);
  console.log(`quantum drive foundry records loaded: ${quantumDriveStatsByEntityClass.size}`);
  console.log(`quantum drive records joined: ${records.filter((record) => record.type === "quantumdrive" && record.stats.quantumDrive).length}`);
  console.log(`quantum drive populated fields: ${JSON.stringify(countPopulatedQuantumDriveFields(records))}`);
  console.log(`validation: passed`);
  console.log(`approx compact payload size: ${bytes.toLocaleString()} bytes`);
}

await main();
