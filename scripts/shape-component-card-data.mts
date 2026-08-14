import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getComponentCardsRoot } from "../server/config/componentCardsRoot.ts";
import {
  createComponentCardIdentityContext,
  enrichComponentCardRecord,
} from "./component-card-fitting-identity.mts";
import {
  filterInventoryRecipeInputs,
  stripNonInventoryRecipePartsFromSearchText,
} from "./lib/componentCardRecipeSearch.mts";
import {
  getScintelComponentCardSourcePath,
  getScintelCraftingSourcePath,
} from "./lib/scintelDatasetSource.mts";

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
  materials?: Array<{
    materialKey?: unknown;
    aliases?: Record<string, unknown>;
  }>;
};

const sourcePath = getScintelComponentCardSourcePath();
const blueprintsPath = getScintelCraftingSourcePath("blueprints.json");
const fpsBlueprintsPath = getScintelCraftingSourcePath("fps", "fps_blueprints.json");
const materialIdentityPath = getScintelCraftingSourcePath("material_identity_index.json");
const outputRoot = getComponentCardsRoot();
const byIdRoot = path.join(outputRoot, "by-id");

type BlueprintRecord = {
  blueprintGuid?: unknown;
  componentType?: unknown;
  fpsCategory?: unknown;
  entityClass?: unknown;
  entityClassPath?: unknown;
  blueprintName?: unknown;
  blueprintPath?: unknown;
  displayName?: unknown;
  outputDisplayName?: unknown;
  size?: unknown;
  grade?: unknown;
  class?: unknown;
  manufacturerGuid?: unknown;
  craftTimeSeconds?: unknown;
  baseStats?: unknown;
  materials?: unknown;
  materialRequirements?: unknown;
  weaponClass?: unknown;
  armorSlot?: unknown;
  armorWeight?: unknown;
  ammoClass?: unknown;
  familyKey?: unknown;
  familyDisplayName?: unknown;
  variantName?: unknown;
  qualityModifiers?: Array<{ gameplayProperty?: unknown }> | null;
};

type FittingShipWeapon = JsonRecord & {
  entityClass?: unknown;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatCraftTime(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function genericStats(baseStats: unknown): JsonRecord {
  const base = asRecord(baseStats) ?? {};
  const em = asRecord(base.emSignature);
  const ir = asRecord(base.irSignature);
  const distortion = asRecord(base.distortion);
  return {
    mass: asNumber(base.mass),
    health: asNumber(base.health),
    emSignature: asNumber(em?.nominalSignature),
    irSignature: asNumber(ir?.nominalSignature),
    distortionMaximum: asNumber(distortion?.maximum),
  };
}

function damageType(weapon: FittingShipWeapon): string | null {
  const damageFields: Array<[string, unknown]> = [
    ["physical", weapon.damagePhysical],
    ["energy", weapon.damageEnergy],
    ["distortion", weapon.damageDistortion],
    ["thermal", weapon.damageThermal],
    ["biochemical", weapon.damageBiochemical],
    ["stun", weapon.damageStun],
  ];
  const active = damageFields.filter(([, value]) => (asNumber(value) ?? 0) > 0).map(([label]) => label);
  return active.length === 1 ? active[0] : active.length > 1 ? "mixed" : null;
}

function shapeFittingShipWeapon(weapon: FittingShipWeapon | undefined): JsonRecord | null {
  if (!weapon) return null;
  return {
    weaponClass: asString(weapon.weaponClass),
    weaponType: asString(weapon.weaponType) ?? asString(weapon.itemType),
    damageType: damageType(weapon),
    damagePhysical: asNumber(weapon.damagePhysical),
    damageEnergy: asNumber(weapon.damageEnergy),
    damageDistortion: asNumber(weapon.damageDistortion),
    damageThermal: asNumber(weapon.damageThermal),
    damageBiochemical: asNumber(weapon.damageBiochemical),
    damageStun: asNumber(weapon.damageStun),
    alphaDamageTotal: asNumber(weapon.alphaDamageTotal),
    fireRateRpm: asNumber(weapon.fireRateRpm),
    chargeTime: asNumber(weapon.chargeTime),
    ammoCapacity: asNumber(weapon.ammoCapacity),
    ammoCostPerShot: asNumber(weapon.ammoCostPerShot),
    projectileSpeed: asNumber(weapon.projectileSpeed),
    projectileLifetime: asNumber(weapon.projectileLifetime),
    calculatedRange: asNumber(weapon.calculatedRange),
    heatPerShot: asNumber(weapon.heatPerShot),
    heatCapacity: asNumber(weapon.heatCapacity),
    penetration: asNumber(weapon.maxPenetrationThickness),
    penetrationDistance: asNumber(weapon.basePenetrationDistance),
    powerUsageMin: asNumber(weapon.powerUsage),
    powerUsageMax: asNumber(weapon.powerUsage),
    onlineEmSignature: asNumber(weapon.radarEmission),
    onlineIrSignature: asNumber(weapon.infraredEmission),
  };
}

async function loadCurrentFittingShipWeapons(): Promise<Map<string, FittingShipWeapon>> {
  const pointerPath = path.resolve("server-data", "fitting", "current.json");
  const pointer = asRecord(JSON.parse(await readFile(pointerPath, "utf8")));
  const channels = asRecord(pointer?.channels);
  const live = asRecord(channels?.LIVE);
  const buildId = asString(live?.currentBuildId);
  if (!buildId) throw new Error(`Missing LIVE fitting build pointer in ${pointerPath}`);

  const registryPath = path.resolve("server-data", "fitting", "LIVE", buildId, "ship_weapons.json");
  const payload = asRecord(JSON.parse(await readFile(registryPath, "utf8")));
  const records = Array.isArray(payload?.records) ? payload.records : [];
  const map = new Map<string, FittingShipWeapon>();
  for (const rawRecord of records) {
    const record = asRecord(rawRecord) as FittingShipWeapon | null;
    const entityClass = normalizeId(record?.entityClass);
    if (record && entityClass) map.set(entityClass, record);
  }
  return map;
}

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

function buildFilterableMaterialKeys(index: MaterialIdentityIndex): Set<string> {
  const keys = new Set<string>();
  for (const material of index.materials ?? []) {
    const key = typeof material.materialKey === "string" ? material.materialKey.trim() : "";
    const aliasIds = material.aliases && typeof material.aliases === "object"
      ? Object.values(material.aliases).flatMap((value) => Array.isArray(value) ? value : [])
      : [];
    const isRecipePart = isNonInventoryRecipePart({ materialKey: key }) || aliasIds.some((id) => isNonInventoryRecipePart({
      costId: id,
      materialKey: key,
    }));
    if (key && !isRecipePart) keys.add(key);
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

function filterNonInventoryRecipeParts(value: unknown): unknown[] {
  return filterInventoryRecipeInputs(value);
}

function supplementalMaterials(blueprint: BlueprintRecord): JsonRecord[] {
  const rawMaterials = Array.isArray(blueprint.materialRequirements)
    ? blueprint.materialRequirements
    : Array.isArray(blueprint.materials) ? blueprint.materials : [];
  return filterNonInventoryRecipeParts(rawMaterials).flatMap((rawMaterial) => {
    const material = asRecord(rawMaterial);
    if (!material) return [];
    const name = asString(material.materialName) ?? asString(material.name);
    const costId = normalizeId(material.costId) ?? normalizeId(material.materialId);
    if (!name || !costId) return [];
    return [{
      slot: asString(material.slotDisplayName) ?? asString(material.slot),
      name: titleCase(name),
      quantity: asNumber(material.quantity),
      unit: asString(material.unit) ?? asString(material.unitType),
      materialId: normalizeId(material.materialId) ?? costId,
      costId,
      materialKey: asString(material.materialKey),
      minQuality: asNumber(material.minQuality),
    }];
  });
}

function modifierLabels(blueprint: BlueprintRecord): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const modifier of blueprint.qualityModifiers ?? []) {
    const property = asString(modifier.gameplayProperty);
    if (!property || seen.has(property)) continue;
    seen.add(property);
    labels.push(formatModifierProperty(property));
  }
  return labels;
}

function searchableParts(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(searchableParts);
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  return [];
}

function buildSearchData(parts: unknown[]): { searchText: string; searchTokens: string[] } {
  const normalized = parts.flatMap(searchableParts).join(" ").toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]+/g, "");
  const searchText = `${normalized} ${compact}`.trim();
  const searchTokens = [...new Set(normalized.split(/[^a-z0-9]+/).filter(Boolean))].sort();
  return { searchText, searchTokens };
}

function supplementalRecord(
  blueprint: BlueprintRecord,
  fittingShipWeapons: Map<string, FittingShipWeapon>,
): JsonRecord | null {
  const id = normalizeId(blueprint.blueprintGuid);
  const entityClass = normalizeId(blueprint.entityClass);
  const fpsCategory = asString(blueprint.fpsCategory);
  const isFps = Boolean(fpsCategory);
  const type = isFps ? fpsCategory : asString(blueprint.componentType);
  if (!id || !type) return null;

  const fallbackName = asString(blueprint.familyDisplayName) ?? asString(blueprint.blueprintName);
  const name = asString(blueprint.outputDisplayName) ?? asString(blueprint.displayName) ?? fallbackName;
  if (!name) return null;

  const kind = isFps ? "fps" : "vehicle";
  const typeLabel = isFps
    ? ({ armor: "FPS Armor", weapons: "FPS Weapon", ammo: "FPS Ammo" }[type] ?? `FPS ${titleCase(type)}`)
    : ({ weaponGun: "Ship Weapon" }[type] ?? titleCase(type));
  const materials = supplementalMaterials(blueprint);
  const materialIds = materials.map((material) => material.costId).filter(Boolean);
  const materialNames = materials
    .map((material) => asString(material.materialKey) ?? asString(material.name)?.replace(/[^a-z0-9]+/gi, "").toLowerCase())
    .filter((value): value is string => Boolean(value));
  const craftTimeSeconds = asNumber(blueprint.craftTimeSeconds);
  const size = asNumber(blueprint.size);
  const grade = asString(blueprint.grade);
  const componentClass = asString(blueprint.class);
  const family = asString(blueprint.familyDisplayName);
  const familyKey = asString(blueprint.familyKey);
  const variantName = asString(blueprint.variantName);
  const labels = modifierLabels(blueprint);
  const fittingWeapon = entityClass ? fittingShipWeapons.get(entityClass) : undefined;
  const generic = genericStats(blueprint.baseStats);
  if (fittingWeapon) {
    generic.mass = asNumber(fittingWeapon.mass) ?? generic.mass;
    generic.health = asNumber(fittingWeapon.health) ?? generic.health;
    generic.emSignature = asNumber(fittingWeapon.radarEmission) ?? generic.emSignature;
    generic.irSignature = asNumber(fittingWeapon.infraredEmission) ?? generic.irSignature;
  }

  const stats: JsonRecord = {
    generic,
    cooler: null,
    powerPlant: null,
    quantumDrive: null,
    shield: null,
    shipWeapon: type === "weaponGun" ? shapeFittingShipWeapon(fittingWeapon) : null,
    radar: null,
    miningLaser: null,
    tractorBeam: null,
    fpsWeapon: type === "weapons" ? {
      weaponClass: asString(blueprint.weaponClass),
      family,
      variantName,
      variantCount: 1,
    } : null,
    fpsArmor: type === "armor" ? {
      armorSlot: asString(blueprint.armorSlot),
      armorWeight: asString(blueprint.armorWeight),
      family,
      variantName,
      variantCount: 1,
    } : null,
    fpsAmmo: type === "ammo" ? {
      ammoClass: asString(blueprint.ammoClass),
      family,
      variantName,
      variantCount: 1,
    } : null,
  };

  const search = buildSearchData([
    id, name, kind, type, typeLabel, size, grade, componentClass, entityClass,
    blueprint.blueprintName, blueprint.blueprintPath, family, familyKey, variantName,
    blueprint.weaponClass, blueprint.armorSlot, blueprint.armorWeight, blueprint.ammoClass,
    materials.flatMap((material) => [material.name, material.materialKey, material.costId]),
    blueprint.qualityModifiers?.map((modifier) => modifier.gameplayProperty),
  ]);
  const primary = [
    size === null ? null : { label: "Size", value: `S${size}` },
    grade ? { label: "Grade", value: grade } : null,
    formatCraftTime(craftTimeSeconds) ? { label: "Craft", value: formatCraftTime(craftTimeSeconds) } : null,
    entityClass ? { label: "Entity", value: entityClass.slice(0, 8) } : null,
  ].filter(Boolean);
  const secondary = [
    asString(blueprint.weaponClass) ? { label: "Weapon class", value: titleCase(asString(blueprint.weaponClass) as string) } : null,
    asString(blueprint.armorSlot) ? { label: "Armor slot", value: titleCase(asString(blueprint.armorSlot) as string) } : null,
    asString(blueprint.armorWeight) ? { label: "Armor weight", value: titleCase(asString(blueprint.armorWeight) as string) } : null,
    family ? { label: type === "armor" ? "Armor family" : "Family", value: family } : null,
    variantName ? { label: "Variant", value: variantName } : null,
  ].filter(Boolean).slice(0, 4);

  return {
    id,
    name,
    kind,
    category: kind,
    type,
    typeLabel,
    size,
    grade,
    class: componentClass,
    manufacturerGuid: normalizeId(blueprint.manufacturerGuid),
    manufacturer: null,
    family,
    familyKey,
    variants: familyKey ? [familyKey] : [],
    variantName,
    entityClass,
    craftTimeSeconds,
    materials,
    ...search,
    facets: {
      kind,
      category: kind,
      type: typeLabel.toLowerCase(),
      size: size === null ? null : String(size),
      grade,
      class: componentClass,
      materials: materialIds,
      materialNames,
      weaponClass: asString(blueprint.weaponClass),
      armorSlot: asString(blueprint.armorSlot),
      armorWeight: asString(blueprint.armorWeight),
      ammoClass: asString(blueprint.ammoClass),
      sourcePools: [],
    },
    sort: {
      name: name.toLowerCase(),
      type: typeLabel.toLowerCase(),
      craftTimeSeconds,
      size,
      gradeRank: null,
      materialCount: materials.length,
      sourceCount: 0,
    },
    card: {
      primary,
      secondary,
      materialsPreview: materials.slice(0, 3).map((material) => ({
        name: material.name,
        quantity: material.quantity,
        unit: material.unit,
      })),
      badges: labels,
      modifierLabels: labels,
    },
    stats,
    source: {
      files: [isFps ? fpsBlueprintsPath.replace(/\\/g, "/") : blueprintsPath.replace(/\\/g, "/")],
      fields: [
        "identity and recipe fields sourced from the current blueprint extraction",
        ...(fittingWeapon ? ["stats.shipWeapon sourced from the current fitting ship-weapons registry"] : []),
      ],
      warnings: [
        "supplemented because this current recipe was absent from the upstream component-card snapshot",
        ...(!fittingWeapon && type === "weaponGun" ? ["typed ship-weapon performance was unavailable from the current fitting registry"] : []),
        ...(isFps ? ["typed FPS performance remains unavailable; only extracted identity fields are exposed"] : []),
      ],
    },
  };
}

function buildMaterialsPreview(record: JsonRecord, card: JsonRecord | null): unknown[] {
  const materials = filterNonInventoryRecipeParts(record.materials);
  if (materials.length > 0 || Array.isArray(record.materials)) {
    return materials.slice(0, 3).map((rawMaterial) => {
      const material = asRecord(rawMaterial);
      if (!material) return rawMaterial;
      return {
        name: material.name,
        quantity: material.quantity,
        unit: material.unit,
      };
    });
  }
  return filterNonInventoryRecipeParts(card?.materialsPreview).slice(0, 3);
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
    "penetration",
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
  slimCard.materialsPreview = buildMaterialsPreview(record, card);

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
    searchText: stripNonInventoryRecipePartsFromSearchText(record.searchText, record.materials),
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
const fpsBlueprints = JSON.parse(await readFile(fpsBlueprintsPath, "utf8")) as BlueprintRecord[];
const materialIdentityIndex = JSON.parse(await readFile(materialIdentityPath, "utf8")) as MaterialIdentityIndex;
const fittingShipWeapons = await loadCurrentFittingShipWeapons();
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

if (sourceRecords.length === 0) {
  throw new Error(`No records found in ${sourcePath}`);
}

const catalogRecords = [...blueprints, ...fpsBlueprints];
const catalogIds = catalogRecords
  .map((blueprint) => normalizeId(blueprint.blueprintGuid))
  .filter((id): id is string => Boolean(id));
const authoritativeCatalogIds = new Set(catalogIds);
if (authoritativeCatalogIds.size !== catalogIds.length) {
  throw new Error("Current crafting catalogs contain missing or duplicate blueprint identities.");
}

// The accepted current recipe catalogs are the identity authority. Older
// component-card snapshots may still contain removed development templates;
// their statistics must not make those templates browseable craftables.
const retainedSourceRecords = sourceRecords.filter((record) => {
  const id = normalizeId(record.id);
  return Boolean(id && authoritativeCatalogIds.has(id));
});
const excludedSourceRecordCount = sourceRecords.length - retainedSourceRecords.length;
const sourceIds = new Set(
  retainedSourceRecords.map((record) => normalizeId(record.id)).filter(Boolean),
);
const supplementalRecords = [...blueprints, ...fpsBlueprints]
  .filter((blueprint) => {
    const id = normalizeId(blueprint.blueprintGuid);
    return id && !sourceIds.has(id);
  })
  .map((blueprint) => supplementalRecord(blueprint, fittingShipWeapons))
  .filter((record): record is JsonRecord => record !== null);
const allRecords = [...retainedSourceRecords, ...supplementalRecords];
const materialKeyByFacetValue = getMaterialKeyByFacetValue(allRecords);
warnings.push(
  `Excluded ${excludedSourceRecordCount} upstream records absent from the current crafting catalogs.`,
);
warnings.push(`Supplemented ${supplementalRecords.length} current recipes absent from the upstream component-card snapshot.`);

const seenIds = new Map<string, number>();
const recordFiles: Record<string, string> = {};
const browseRecords: JsonRecord[] = [];
let missingIdCount = 0;
let duplicateIdCount = 0;
let skippedCount = 0;

for (const [index, rawRecord] of allRecords.entries()) {
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
    materialsPreview: Array.isArray(browseCard?.materialsPreview) ? browseCard.materialsPreview : [],
  };
  const shapedFacets = asRecord(identityRecord.facets);
  const shapedMaterials = filterNonInventoryRecipeParts(identityRecord.materials);
  const shapedSort = asRecord(identityRecord.sort);
  const shapedRecord = {
    ...identityRecord,
    ...(Array.isArray(identityRecord.materials) ? { materials: shapedMaterials } : {}),
    ...(shapedFacets ? { facets: filterRecordMaterialFacets(shapedFacets, materialKeyByFacetValue, filterableMaterialKeys) } : {}),
    ...(shapedSort && Array.isArray(identityRecord.materials)
      ? { sort: { ...shapedSort, materialCount: shapedMaterials.length } }
      : {}),
    card: shapedCard,
  };
  browseRecords.push(browseRecord);

  await writeJson(path.join(outputRoot, relativeFile), shapedRecord);
}

const shapedRecordCount = browseRecords.length;
const expectedTotal = authoritativeCatalogIds.size;

if (shapedRecordCount !== expectedTotal) {
  throw new Error(
    `Shaped record count (${shapedRecordCount}) does not match expected current catalog total (${expectedTotal}).`,
  );
}

const generatedAt = new Date().toISOString();

await writeJson(path.join(outputRoot, "facets.json"), {
  schemaVersion: 1,
  generatedAt,
  facets: filterFacetSummary(source.facets ?? {}, materialKeyByFacetValue, filterableMaterialKeys),
});

await writeJson(path.join(outputRoot, "browse.json"), {
  schemaVersion: 1,
  generatedAt,
  recordCount: shapedRecordCount,
  records: browseRecords,
});

await writeJson(path.join(outputRoot, "index.json"), {
  schemaVersion: 1,
  generatedAt,
  sourceGeneratedAt: generatedAt,
  upstreamGeneratedAt: source.generatedAt ?? null,
  sourcePath: sourcePath.replace(/\\/g, "/"),
  sourceRecordCount: {
    vehicle: browseRecords.filter((record) => record.kind === "vehicle").length,
    fps: browseRecords.filter((record) => record.kind === "fps").length,
    total: shapedRecordCount,
  },
  upstreamSourceRecordCount: source.sourceRecordCount ?? null,
  excludedUpstreamRecordCount: excludedSourceRecordCount,
  supplementalRecordCount: supplementalRecords.length,
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
