import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getComponentCardsRoot } from "../server/config/componentCardsRoot.ts";

type JsonRecord = Record<string, unknown>;

type SourceIndex = {
  schemaVersion?: number;
  generatedAt?: string;
  sourceRecordCount?: {
    vehicle?: number;
    fps?: number;
    total?: number;
  };
  records?: JsonRecord[];
  facets?: unknown;
};

const sourcePath = path.resolve("public", "api", "crafting", "component_card_index.json");
const blueprintsPath = path.resolve("public", "api", "crafting", "blueprints.json");
const outputRoot = getComponentCardsRoot();
const byIdRoot = path.join(outputRoot, "by-id");

type BlueprintRecord = {
  blueprintGuid?: unknown;
  componentType?: unknown;
  qualityModifiers?: Array<{ gameplayProperty?: unknown }> | null;
};

function formatModifierProperty(raw: string): string {
  return raw.replace(/^GPP_/, "").replace(/_/g, " ");
}

function buildWeaponModifierBadgeMap(blueprints: BlueprintRecord[]): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const blueprint of blueprints) {
    if (blueprint.componentType !== "weaponGun") continue;

    const id = normalizeId(blueprint.blueprintGuid);
    if (!id) continue;

    const seen = new Set<string>();
    const labels: string[] = [];
    for (const modifier of blueprint.qualityModifiers ?? []) {
      const raw = typeof modifier.gameplayProperty === "string" ? modifier.gameplayProperty.trim() : "";
      if (!raw || seen.has(raw)) continue;
      seen.add(raw);
      labels.push(formatModifierProperty(raw));
    }

    if (labels.length > 0) map.set(id, labels);
  }

  return map;
}

function isGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function normalizeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed && isGuid(trimmed) ? trimmed : null;
}

function recordFileName(id: string): string {
  return `${id.toLowerCase()}.json`;
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : null;
}

const BROWSE_GENERIC_STAT_FIELDS = ["mass", "health"] as const;

const BROWSE_TYPE_STAT_FIELDS: Record<string, readonly string[]> = {
  shield: [
    "maxShieldHealth",
    "regenRate",
    "damageRegenDelay",
    "downedRegenDelay",
    "physicalAbsorption",
    "physicalResistance",
    "powerUsageMin",
    "powerUsageMax",
    "coolantUsageMin",
    "coolantUsageMax",
  ],
  quantumDrive: [
    "normalJumpSpeed",
    "spoolTime",
    "cooldown",
    "quantumFuelRequirement",
    "quantumFuelConsumptionRate",
    "calibrationRequirementMin",
    "calibrationRequirementMax",
    "powerUsageMin",
    "powerUsageMax",
    "coolantUsageMin",
    "coolantUsageMax",
  ],
  cooler: [
    "coolantGeneration",
    "powerUsageMin",
    "powerUsageMax",
    "selfRepairTime",
    "onlineEmSignature",
    "onlineIrSignature",
  ],
  powerPlant: [
    "powerGeneration",
    "heatGeneration",
    "coolantUsageMin",
    "coolantUsageMax",
    "selfRepairTime",
    "onlineEmSignature",
    "onlineIrSignature",
  ],
  shipWeapon: [
    "damageType",
    "alphaDamageTotal",
    "fireRateRpm",
    "ammoCapacity",
    "calculatedRange",
    "projectileSpeed",
  ],
  fpsWeapon: [
    "weaponClass",
    "fireMode",
    "fireRateRpm",
    "ammoCapacity",
    "chargeTime",
    "alphaDamageTotal",
    "dps",
    "hardRange",
    "projectileLifetimeTravel",
    "calculatedRange",
    "falloffGraphStatus",
    "damageDropMinDistance",
    "damageDropPerMeter",
    "damageDropMinDamage",
    "attachments",
  ],
  fpsArmor: [
    "armorSlot",
    "armorWeight",
    "physicalResistance",
    "energyResistance",
    "temperatureMin",
    "temperatureMax",
    "storageCapacity",
    "mass",
  ],
  fpsAmmo: [
    "ammoClass",
    "compatibleWeaponClass",
    "magazineCapacity",
    "alphaDamageTotal",
    "hardRange",
    "projectileLifetimeTravel",
    "calculatedRange",
    "projectileSpeed",
    "damageDropMinDistance",
    "damageDropPerMeter",
    "damageDropMinDamage",
    "penetrationBaseDistance",
  ],
  radar: [
    "pingCooldown",
    "aimAssistRangeMin",
    "aimAssistRangeMax",
    "powerUsageMin",
    "powerUsageMax",
    "coolantUsageMin",
    "coolantUsageMax",
    "onlineEmSignature",
    "onlineIrSignature",
  ],
  miningLaser: [
    "miningPower",
    "extractionPower",
    "instabilityModifier",
    "resistanceModifier",
    "fractureWindowSize",
    "laserRange",
    "beamRange",
    "compatibleConsumables",
    "powerUsageMin",
    "powerUsageMax",
    "heatGeneration",
    "wearRate",
  ],
  weaponMining: [
    "miningPower",
    "extractionPower",
    "instabilityModifier",
    "resistanceModifier",
    "fractureWindowSize",
    "laserRange",
    "beamRange",
    "compatibleConsumables",
    "powerUsageMin",
    "powerUsageMax",
    "heatGeneration",
    "wearRate",
  ],
};

function pickRecordFields(record: JsonRecord, fields: readonly string[]): JsonRecord {
  const picked: JsonRecord = {};
  for (const field of fields) {
    if (field in record) picked[field] = record[field];
  }
  return picked;
}

function slimAttachmentPreview(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    const attachment = asRecord(item);
    if (!attachment) return item;
    const slim: JsonRecord = {};
    if ("type" in attachment) slim.type = attachment.type;
    if (Array.isArray(attachment.subTypes)) slim.subTypes = attachment.subTypes;
    return slim;
  });
}

function toBrowseStats(record: JsonRecord): JsonRecord | undefined {
  const stats = asRecord(record.stats);
  if (!stats) return undefined;

  const slim: JsonRecord = {};
  const generic = asRecord(stats.generic);
  if (generic) {
    const slimGeneric = pickRecordFields(generic, BROWSE_GENERIC_STAT_FIELDS);
    if (Object.keys(slimGeneric).length > 0) slim.generic = slimGeneric;
  }

  for (const [group, fields] of Object.entries(BROWSE_TYPE_STAT_FIELDS)) {
    const groupStats = asRecord(stats[group]);
    if (!groupStats) continue;
    const picked = pickRecordFields(groupStats, fields);
    if (group === "fpsWeapon" && "attachments" in groupStats) {
      picked.attachments = slimAttachmentPreview(groupStats.attachments);
    }
    if (Object.keys(picked).length > 0) slim[group] = picked;
  }

  return Object.keys(slim).length > 0 ? slim : undefined;
}

function toBrowseSlim(record: JsonRecord, weaponModifierBadges: Map<string, string[]>): JsonRecord {
  const facets = asRecord(record.facets);
  const card = asRecord(record.card);
  const sort = asRecord(record.sort);

  const slimFacets: JsonRecord = {};
  if (facets) {
    if (Array.isArray(facets.materials)) slimFacets.materials = facets.materials;
    if (Array.isArray(facets.materialNames)) slimFacets.materialNames = facets.materialNames;
    if ("weaponClass" in facets) slimFacets.weaponClass = facets.weaponClass;
    if ("armorSlot" in facets) slimFacets.armorSlot = facets.armorSlot;
    if ("armorWeight" in facets) slimFacets.armorWeight = facets.armorWeight;
    if ("ammoClass" in facets) slimFacets.ammoClass = facets.ammoClass;
  }

  const slimCard: JsonRecord = {};
  if (card) {
    let badges = Array.isArray(card.badges) ? [...card.badges] : [];
    if (record.type === "weaponGun" && badges.length === 0) {
      const id = normalizeId(record.id);
      if (id) badges = weaponModifierBadges.get(id) ?? badges;
    }
    if (badges.length > 0) slimCard.badges = badges;
    if (Array.isArray(card.materialsPreview)) slimCard.materialsPreview = card.materialsPreview;
  }

  const slimSort: JsonRecord = {};
  if (sort) {
    if (typeof sort.name === "string") slimSort.name = sort.name;
    if (typeof sort.type === "string") slimSort.type = sort.type;
  }

  const slim: JsonRecord = {
    id: record.id,
    name: record.name,
    kind: record.kind,
    category: record.category,
    type: record.type,
    typeLabel: record.typeLabel,
    size: record.size,
    grade: record.grade,
    class: record.class,
    craftTimeSeconds: record.craftTimeSeconds,
    searchText: record.searchText,
  };

  const browseStats = toBrowseStats(record);
  if (browseStats) slim.stats = browseStats;

  if (record.family !== undefined) slim.family = record.family;
  if (record.familyKey !== undefined) slim.familyKey = record.familyKey;
  if (record.variantName !== undefined) slim.variantName = record.variantName;
  if (record.manufacturer !== undefined) slim.manufacturer = record.manufacturer;

  if (Object.keys(slimFacets).length > 0) slim.facets = slimFacets;
  if (Object.keys(slimCard).length > 0) slim.card = slimCard;
  if (Object.keys(slimSort).length > 0) slim.sort = slimSort;

  return slim;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

const source = JSON.parse(await readFile(sourcePath, "utf8")) as SourceIndex;
const blueprints = JSON.parse(await readFile(blueprintsPath, "utf8")) as BlueprintRecord[];
const weaponModifierBadges = buildWeaponModifierBadgeMap(blueprints);
const warnings: string[] = [];
const sourceRecords = Array.isArray(source.records) ? source.records : [];

if (sourceRecords.length === 0) {
  throw new Error(`No records found in ${sourcePath}`);
}

const seenIds = new Map<string, number>();
const recordFiles: Record<string, string> = {};
const browseRecords: JsonRecord[] = [];
let missingIdCount = 0;
let duplicateIdCount = 0;
let skippedCount = 0;

for (const [index, rawRecord] of sourceRecords.entries()) {
  if (typeof rawRecord !== "object" || rawRecord === null) {
    skippedCount += 1;
    warnings.push(`Record at index ${index} is not an object and was skipped.`);
    continue;
  }

  const id = normalizeId(rawRecord.id);
  if (!id) {
    missingIdCount += 1;
    warnings.push(`Record at index ${index} is missing a valid id and was skipped.`);
    continue;
  }

  const seen = seenIds.get(id) ?? 0;
  seenIds.set(id, seen + 1);
  if (seen > 0) {
    duplicateIdCount += 1;
    warnings.push(`Duplicate id ${id} at source index ${index}; kept first shaped record only.`);
    continue;
  }

  const relativeFile = path.join("by-id", recordFileName(id)).replace(/\\/g, "/");
  recordFiles[id] = relativeFile;
  browseRecords.push(toBrowseSlim(rawRecord, weaponModifierBadges));

  await writeJson(path.join(outputRoot, relativeFile), rawRecord);
}

const shapedRecordCount = browseRecords.length;
const sourceTotal = source.sourceRecordCount?.total ?? sourceRecords.length;

if (shapedRecordCount !== sourceTotal) {
  warnings.push(
    `Shaped record count (${shapedRecordCount}) does not match sourceRecordCount.total (${sourceTotal}).`,
  );
}

await writeJson(path.join(outputRoot, "facets.json"), {
  schemaVersion: 1,
  generatedAt: source.generatedAt ?? null,
  facets: source.facets ?? {},
});

await writeJson(path.join(outputRoot, "browse.json"), {
  schemaVersion: 1,
  generatedAt: source.generatedAt ?? null,
  recordCount: shapedRecordCount,
  records: browseRecords,
});

await writeJson(path.join(outputRoot, "index.json"), {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceGeneratedAt: source.generatedAt ?? null,
  sourcePath: sourcePath.replace(/\\/g, "/"),
  sourceRecordCount: source.sourceRecordCount ?? {
    vehicle: 0,
    fps: 0,
    total: sourceRecords.length,
  },
  shapedRecordCount,
  missingIdCount,
  duplicateIdCount,
  skippedCount,
  warnings,
  recordFiles,
});

console.log("Component card shaping complete.");
console.log(`Source: ${sourcePath}`);
console.log(`Output: ${outputRoot}`);
console.log(`Shaped records: ${shapedRecordCount}`);
console.log(`Missing ids: ${missingIdCount}`);
console.log(`Duplicate ids: ${duplicateIdCount}`);
console.log(`Skipped records: ${skippedCount}`);
if (warnings.length > 0) {
  console.log(`Warnings: ${warnings.length}`);
  for (const warning of warnings.slice(0, 10)) {
    console.log(`- ${warning}`);
  }
  if (warnings.length > 10) {
    console.log(`- ... ${warnings.length - 10} more`);
  }
}