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
const outputRoot = getComponentCardsRoot();
const byIdRoot = path.join(outputRoot, "by-id");

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

function toBrowseSlim(record: JsonRecord): JsonRecord {
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
    if (Array.isArray(card.badges)) slimCard.badges = card.badges;
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
    stats: record.stats,
  };

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
  browseRecords.push(toBrowseSlim(rawRecord));

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