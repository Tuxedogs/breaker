import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getComponentCardsRoot } from "../server/config/componentCardsRoot.ts";
import {
  createComponentCardIdentityContext,
  enrichComponentCardRecord,
} from "./component-card-fitting-identity.mts";

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

type MaterialIdentityIndex = {
  materials?: Array<{ materialKey?: unknown; sources?: unknown }>;
};

const sourcePath = path.resolve("public", "api", "crafting", "component_card_index.json");
const blueprintsPath = path.resolve("public", "api", "crafting", "blueprints.json");
const materialIdentityPath = path.resolve("public", "api", "crafting", "material_identity_index.json");
const outputRoot = getComponentCardsRoot();
const byIdRoot = path.join(outputRoot, "by-id");

type BlueprintRecord = {
  blueprintGuid?: unknown;
  componentType?: unknown;
  entityClass?: unknown;
  entityClassPath?: unknown;
  blueprintName?: unknown;
  displayName?: unknown;
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

function hasFilterableMaterialSource(sources: unknown): boolean {
  if (!Array.isArray(sources)) return false;
  return sources.some((source) => {
    const text = typeof source === "string" ? source.toLowerCase().replace(/\\/g, "/") : "";
    return text.includes("/crafting/qualityquantization/")
      || text.includes("/harvestable/")
      || text.includes("/entities/scitem/carryables/")
      || text.includes("/contracts/contracttemplates/");
  });
}

function buildFilterableMaterialKeys(index: MaterialIdentityIndex): Set<string> {
  const keys = new Set<string>();
  for (const material of index.materials ?? []) {
    const key = typeof material.materialKey === "string" ? material.materialKey.trim() : "";
    if (key && hasFilterableMaterialSource(material.sources)) keys.add(key);
  }
  return keys;
}

function getMaterialKeyByFacetValue(records: JsonRecord[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const record of records) {
    const materials = Array.isArray(record.materials) ? record.materials : [];
    for (const rawMaterial of materials) {
      const material = asRecord(rawMaterial);
      if (!material) continue;
      const materialKey = typeof material.materialKey === "string" ? material.materialKey.trim() : "";
      if (!materialKey) continue;
      const values = [material.costId, material.materialId, material.name]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
      for (const value of values) map.set(value, materialKey);
    }
  }
  return map;
}

function isFilterableMaterialFacet(value: unknown, materialKeyByFacetValue: Map<string, string>, filterableMaterialKeys: Set<string>): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  const materialKey = materialKeyByFacetValue.get(value);
  return Boolean(materialKey && filterableMaterialKeys.has(materialKey));
}

function filterRecordMaterialFacets(
  facets: JsonRecord,
  materialKeyByFacetValue: Map<string, string>,
  filterableMaterialKeys: Set<string>,
): JsonRecord {
  const next = { ...facets };
  if (Array.isArray(facets.materials)) {
    const allowedNames = new Set<string>();
    next.materials = facets.materials.filter((value) => {
      const keep = isFilterableMaterialFacet(value, materialKeyByFacetValue, filterableMaterialKeys);
      if (keep) {
        const key = typeof value === "string" ? materialKeyByFacetValue.get(value) : null;
        if (key) allowedNames.add(key);
      }
      return keep;
    });
    if (Array.isArray(facets.materialNames)) {
      next.materialNames = facets.materialNames.filter((name) => (
        typeof name === "string" && allowedNames.has(name.replace(/[^a-z0-9]+/g, ""))
      ));
    }
  }
  return next;
}

function filterFacetSummary(
  facets: unknown,
  materialKeyByFacetValue: Map<string, string>,
  filterableMaterialKeys: Set<string>,
): unknown {
  const facetRecord = asRecord(facets);
  if (!facetRecord || !Array.isArray(facetRecord.materials)) return facets;
  return {
    ...facetRecord,
    materials: facetRecord.materials.filter((rawFacet) => {
      const facet = asRecord(rawFacet);
      return facet && isFilterableMaterialFacet(facet.value, materialKeyByFacetValue, filterableMaterialKeys);
    }),
  };
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

function toBrowseSlim(
  record: JsonRecord,
  weaponModifierBadges: Map<string, string[]>,
  materialKeyByFacetValue: Map<string, string>,
  filterableMaterialKeys: Set<string>,
): JsonRecord {
  const rawFacets = asRecord(record.facets);
  const facets = rawFacets ? filterRecordMaterialFacets(rawFacets, materialKeyByFacetValue, filterableMaterialKeys) : null;
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
  let modifierLabels = Array.isArray(card?.modifierLabels)
    ? [...card.modifierLabels]
    : Array.isArray(card?.badges) ? [...card.badges] : [];
  if (record.type === "weaponGun" && modifierLabels.length === 0) {
    const id = normalizeId(record.id);
    if (id) modifierLabels = weaponModifierBadges.get(id) ?? modifierLabels;
  }
  slimCard.modifierLabels = modifierLabels;
  if (modifierLabels.length > 0) slimCard.badges = modifierLabels;
  if (card) {
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

  const entityClass = normalizeId(record.entityClass);
  if (entityClass) slim.entityClass = entityClass;

  const browseStats = toBrowseStats(record);
  if (browseStats) slim.stats = browseStats;

  if (record.family !== undefined) slim.family = record.family;
  if (record.familyKey !== undefined) slim.familyKey = record.familyKey;
  if (record.variantName !== undefined) slim.variantName = record.variantName;
  if (record.variantLabel !== undefined) slim.variantLabel = record.variantLabel;
  if (record.manufacturer !== undefined) slim.manufacturer = record.manufacturer;

  if (Object.keys(slimFacets).length > 0) slim.facets = slimFacets;
  slim.card = slimCard;
  if (Object.keys(slimSort).length > 0) slim.sort = slimSort;

  return slim;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

const source = JSON.parse(await readFile(sourcePath, "utf8")) as SourceIndex;
const blueprints = JSON.parse(await readFile(blueprintsPath, "utf8")) as BlueprintRecord[];
const materialIdentityIndex = JSON.parse(await readFile(materialIdentityPath, "utf8")) as MaterialIdentityIndex;
const weaponModifierBadges = buildWeaponModifierBadgeMap(blueprints);
const blueprintsById = new Map(
  blueprints
    .map((blueprint) => {
      const id = normalizeId(blueprint.blueprintGuid);
      return id ? [id, blueprint] as const : null;
    })
    .filter((entry): entry is readonly [string, BlueprintRecord] => entry !== null),
);
const fittingIdentityContext = createComponentCardIdentityContext(
  path.resolve("server-data", "fitting"),
  blueprints.map((blueprint) => ({
    entityClass: blueprint.entityClass,
    entityClassPath: blueprint.entityClassPath,
    blueprintName: blueprint.blueprintName,
    displayName: blueprint.displayName,
  })),
);
const filterableMaterialKeys = buildFilterableMaterialKeys(materialIdentityIndex);
const warnings: string[] = [];
const sourceRecords = Array.isArray(source.records) ? source.records : [];
const materialKeyByFacetValue = getMaterialKeyByFacetValue(sourceRecords);

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
  const identityRecord = enrichComponentCardRecord(rawRecord, fittingIdentityContext, blueprintsById.get(id));
  const browseRecord = toBrowseSlim(identityRecord, weaponModifierBadges, materialKeyByFacetValue, filterableMaterialKeys);
  const browseCard = asRecord(browseRecord.card);
  const shapedCard = {
    ...(asRecord(identityRecord.card) ?? {}),
    modifierLabels: Array.isArray(browseCard?.modifierLabels) ? browseCard.modifierLabels : [],
  };
  const shapedFacets = asRecord(identityRecord.facets);
  const shapedRecord = {
    ...identityRecord,
    ...(shapedFacets ? { facets: filterRecordMaterialFacets(shapedFacets, materialKeyByFacetValue, filterableMaterialKeys) } : {}),
    card: shapedCard,
  };
  browseRecords.push(browseRecord);

  await writeJson(path.join(outputRoot, relativeFile), shapedRecord);
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
  facets: filterFacetSummary(source.facets ?? {}, materialKeyByFacetValue, filterableMaterialKeys),
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
