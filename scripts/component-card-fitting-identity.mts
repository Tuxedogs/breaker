import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { variantLabelFromBlueprintFields } from "../src/lib/crafting/resolveCraftingDisplayName.ts";

type JsonRecord = Record<string, unknown>;

export type FittingIdentityEntry = {
  entityClass: string;
  displayName: string;
  componentType: string;
  itemType: string | null;
  sourceFile: string | null;
};

export type BlueprintEntityPath = {
  entityClass: unknown;
  entityClassPath: unknown;
  blueprintName?: unknown;
  displayName?: unknown;
};

const FITTING_TYPE_TO_CARD: Record<string, { type: string; typeLabel: string }> = {
  mining_laser: { type: "weaponMining", typeLabel: "Mining Laser" },
  salvage_modifier: { type: "salvageModifier", typeLabel: "Salvage Modifier" },
  salvage_head: { type: "salvageHead", typeLabel: "Salvage Head" },
  fuel_nozzle: { type: "dockingCollar", typeLabel: "Docking Collar" },
};

const GENERIC_BLUEPRINT_LABEL = /^(?:s\d+|small|medium|large|military \d+|utility \d+)$/i;

function isGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function normalizeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed && isGuid(trimmed) ? trimmed : null;
}

export function isGenericBlueprintLabel(name: unknown): boolean {
  if (typeof name !== "string" || !name.trim()) return true;
  return GENERIC_BLUEPRINT_LABEL.test(name.trim());
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : null;
}

function currentBuildRoot(fittingDataRoot: string): string | null {
  const currentPath = path.join(fittingDataRoot, "current.json");
  if (!existsSync(currentPath)) return null;
  const payload = JSON.parse(readFileSync(currentPath, "utf8")) as JsonRecord;
  const channels = asRecord(payload.channels);
  const live = channels ? asRecord(channels.LIVE) : null;
  const buildId = typeof live?.currentBuildId === "string" ? live.currentBuildId : null;
  return buildId ? path.join(fittingDataRoot, "LIVE", buildId) : null;
}

function loadRegistryEntityClasses(buildRoot: string, registryFile: string): Set<string> {
  const filePath = path.join(buildRoot, registryFile);
  if (!existsSync(filePath)) return new Set();
  const payload = JSON.parse(readFileSync(filePath, "utf8")) as JsonRecord;
  const records = Array.isArray(payload.records) ? payload.records : [];
  const ids = new Set<string>();
  for (const row of records) {
    const record = asRecord(row);
    const entityClass = normalizeId(record?.entityClass);
    if (entityClass) ids.add(entityClass);
  }
  return ids;
}

export function loadFittingIdentityMap(fittingDataRoot: string): Map<string, FittingIdentityEntry> {
  const buildRoot = currentBuildRoot(fittingDataRoot);
  if (!buildRoot) return new Map();

  const indexPath = path.join(buildRoot, "component_identity_index.json");
  if (!existsSync(indexPath)) return new Map();

  const payload = JSON.parse(readFileSync(indexPath, "utf8")) as JsonRecord;
  const records = Array.isArray(payload.records) ? payload.records : [];
  const map = new Map<string, FittingIdentityEntry>();

  for (const row of records) {
    const record = asRecord(row);
    const entityClass = normalizeId(record?.entityClass);
    const displayName = typeof record?.displayName === "string" ? record.displayName.trim() : "";
    const componentType = typeof record?.componentType === "string" ? record.componentType.trim() : "";
    if (!entityClass || !displayName || !componentType) continue;
    map.set(entityClass, {
      entityClass,
      displayName,
      componentType,
      itemType: typeof record?.itemType === "string" ? record.itemType : null,
      sourceFile: typeof record?.sourceFile === "string" ? record.sourceFile : null,
    });
  }

  return map;
}

export function buildEntityClassPathMap(blueprints: BlueprintEntityPath[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const blueprint of blueprints) {
    const entityClass = normalizeId(blueprint.entityClass);
    const entityClassPath = typeof blueprint.entityClassPath === "string" ? blueprint.entityClassPath.trim() : "";
    if (entityClass && entityClassPath) map.set(entityClass, entityClassPath);
  }
  return map;
}

function foundryRecordsRoot(): string {
  if (process.env.SCINTEL_FOUNDRY_ROOT) return path.resolve(process.env.SCINTEL_FOUNDRY_ROOT);
  return path.resolve("D:/scintel/data/libs/foundry/records");
}

function localizationIniPath(): string {
  if (process.env.SCINTEL_LOCALIZATION_INI) return path.resolve(process.env.SCINTEL_LOCALIZATION_INI);
  return path.resolve("D:/scintel/data/Data/Localization/english/global.ini");
}

const localizationCache = new Map<string, string | null>();

function lookupLocalizationKey(key: string): string | null {
  const normalizedKey = key.replace(/^@/, "").trim();
  if (localizationCache.has(normalizedKey)) return localizationCache.get(normalizedKey) ?? null;

  const iniPath = localizationIniPath();
  if (!existsSync(iniPath)) {
    localizationCache.set(normalizedKey, null);
    return null;
  }

  const needle = `${normalizedKey}=`;
  const content = readFileSync(iniPath, "utf8");
  const line = content.split(/\r?\n/).find((entry) => entry.startsWith(needle));
  const value = line ? line.slice(needle.length).trim() : null;
  localizationCache.set(normalizedKey, value);
  return value;
}

const xmlLocalizationKeyCache = new Map<string, string | null>();

function localizationKeyFromEntityPath(entityClassPath: string): string | null {
  if (xmlLocalizationKeyCache.has(entityClassPath)) return xmlLocalizationKeyCache.get(entityClassPath) ?? null;

  const relative = entityClassPath.replace(/^libs\/foundry\/records\//i, "").replace(/\\/g, "/");
  const xmlPath = path.join(foundryRecordsRoot(), relative);
  if (!existsSync(xmlPath)) {
    xmlLocalizationKeyCache.set(entityClassPath, null);
    return null;
  }

  const content = readFileSync(xmlPath, "utf8");
  const match = content.match(/<Localization\b[^>]*\bName="(@[^"]+)"/i);
  const key = match?.[1] ?? null;
  xmlLocalizationKeyCache.set(entityClassPath, key);
  return key;
}

function localizedNameFromEntityPath(entityClassPath: string): string | null {
  const key = localizationKeyFromEntityPath(entityClassPath);
  if (!key) return null;
  return lookupLocalizationKey(key);
}

export type ComponentCardIdentityContext = {
  fittingIdentity: Map<string, FittingIdentityEntry>;
  entityClassPathByEntityClass: Map<string, string>;
  salvageHeadEntityClasses: Set<string>;
};

export function createComponentCardIdentityContext(
  fittingDataRoot: string,
  blueprints: BlueprintEntityPath[],
): ComponentCardIdentityContext {
  const buildRoot = currentBuildRoot(fittingDataRoot);
  return {
    fittingIdentity: loadFittingIdentityMap(fittingDataRoot),
    entityClassPathByEntityClass: buildEntityClassPathMap(blueprints),
    salvageHeadEntityClasses: buildRoot
      ? loadRegistryEntityClasses(buildRoot, "salvage_heads.json")
      : new Set(),
  };
}

function applyCardTaxonomy(record: JsonRecord, mapped: { type: string; typeLabel: string }): void {
  record.type = mapped.type;
  record.typeLabel = mapped.typeLabel;
  const facets = asRecord(record.facets);
  if (facets) facets.type = mapped.type;
}

export function enrichComponentCardRecord(
  rawRecord: JsonRecord,
  context: ComponentCardIdentityContext,
  blueprint?: BlueprintEntityPath,
): JsonRecord {
  const entityClass = normalizeId(rawRecord.entityClass);
  if (!entityClass) return rawRecord;

  const enriched: JsonRecord = { ...rawRecord };
  const identity = context.fittingIdentity.get(entityClass);
  const entityClassPath = context.entityClassPathByEntityClass.get(entityClass)
    ?? identity?.sourceFile
    ?? null;

  const variantLabel = variantLabelFromBlueprintFields({
    blueprintName: typeof blueprint?.blueprintName === "string" ? blueprint.blueprintName : null,
    entityClassPath: typeof blueprint?.entityClassPath === "string"
      ? blueprint.entityClassPath
      : entityClassPath,
    displayName: typeof blueprint?.displayName === "string" ? blueprint.displayName : null,
  });
  if (variantLabel) enriched.variantLabel = variantLabel;

  if (identity) {
    if (identity.displayName) {
      enriched.name = identity.displayName;
    }
    const mapped = FITTING_TYPE_TO_CARD[identity.componentType];
    if (mapped) applyCardTaxonomy(enriched, mapped);
  }

  const currentType = typeof enriched.type === "string" ? enriched.type : "";
  if (currentType === "salvageHead" && !context.salvageHeadEntityClasses.has(entityClass)) {
    if (entityClassPath && /tractorbeam/i.test(entityClassPath)) {
      applyCardTaxonomy(enriched, { type: "tractorbeam", typeLabel: "Tractor Beam" });
      if (isGenericBlueprintLabel(enriched.name) && entityClassPath) {
        const localizedName = localizedNameFromEntityPath(entityClassPath);
        if (localizedName) enriched.name = localizedName;
      }
    }
  }

  return enriched;
}
