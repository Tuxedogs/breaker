import { readFile } from "node:fs/promises";
import path from "node:path";

import { getComponentCardsRoot } from "../server/config/componentCardsRoot.ts";
import { handleComponentCardsRoute } from "../server/routes/componentCards.routes.ts";

type ComponentCardsIndex = {
  shapedRecordCount?: number;
  duplicateIdCount?: number;
  missingIdCount?: number;
  recordFiles?: Record<string, string>;
};

type BrowsePayload = {
  records?: Array<{
    id?: string;
    facets?: { materials?: string[]; materialNames?: string[] };
    card?: { modifierLabels?: unknown };
  }>;
};

type MaterialIdentityIndex = {
  materials?: Array<{ materialKey?: string; sources?: unknown[] }>;
};

type SourceIndex = {
  records?: Array<{
    id?: string;
    materials?: Array<{
      name?: string | null;
      costId?: string | null;
      materialId?: string | null;
      materialKey?: string | null;
    }>;
  }>;
};

const root = getComponentCardsRoot();
const index = JSON.parse(await readFile(path.join(root, "index.json"), "utf8")) as ComponentCardsIndex;
const browse = JSON.parse(await readFile(path.join(root, "browse.json"), "utf8")) as BrowsePayload;
const facets = JSON.parse(await readFile(path.join(root, "facets.json"), "utf8")) as { facets?: unknown };
const sourceIndex = JSON.parse(
  await readFile(path.resolve("public", "api", "crafting", "component_card_index.json"), "utf8"),
) as SourceIndex;
const materialIdentity = JSON.parse(
  await readFile(path.resolve("public", "api", "crafting", "material_identity_index.json"), "utf8"),
) as MaterialIdentityIndex;

const shapedCount = index.shapedRecordCount ?? 0;
const recordFiles = index.recordFiles ?? {};
const browseRecords = browse.records ?? [];

if (shapedCount !== 1553) {
  throw new Error(`Expected 1553 shaped records, found ${shapedCount}.`);
}
if ((index.duplicateIdCount ?? 0) !== 0) {
  throw new Error(`Expected 0 duplicate ids, found ${index.duplicateIdCount}.`);
}
if ((index.missingIdCount ?? 0) !== 0) {
  throw new Error(`Expected 0 missing ids, found ${index.missingIdCount}.`);
}
if (browseRecords.length !== shapedCount) {
  throw new Error(`Browse record count ${browseRecords.length} does not match shaped count ${shapedCount}.`);
}
if (Object.keys(recordFiles).length !== shapedCount) {
  throw new Error(`by-id file map count ${Object.keys(recordFiles).length} does not match shaped count ${shapedCount}.`);
}
if (!facets.facets || typeof facets.facets !== "object") {
  throw new Error("facets.json is missing facets payload.");
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

const filterableMaterialKeys = new Set(
  (materialIdentity.materials ?? [])
    .filter((material) => material.materialKey && hasFilterableMaterialSource(material.sources))
    .map((material) => material.materialKey as string),
);

const facetPayload = facets.facets as { materials?: Array<{ value?: string; label?: string }> };
const materialFacets = Array.isArray(facetPayload.materials) ? facetPayload.materials : [];
const sourceRecords = Array.isArray(sourceIndex.records) ? sourceIndex.records : [];
const allRecipeMaterials = new Map<string, { label: string; materialKey: string | null }>();
const excludedNonMaterialInputs = new Map<string, { label: string; materialKey: string | null }>();
const unresolvedIngredientClassifications = new Map<string, { label: string; materialKey: string | null }>();
let linerRequirementCount = 0;

for (const record of sourceRecords) {
  for (const material of record.materials ?? []) {
    const label = material.name?.trim() ?? "";
    const value = material.costId ?? material.materialId ?? label;
    if (!label || !value) continue;
    const materialKey = material.materialKey?.trim() || null;
    allRecipeMaterials.set(value, { label, materialKey });
    if (/insulative liner/i.test(label)) linerRequirementCount += 1;
    if (!materialKey) {
      unresolvedIngredientClassifications.set(value, { label, materialKey });
    } else if (!filterableMaterialKeys.has(materialKey)) {
      excludedNonMaterialInputs.set(value, { label, materialKey });
    }
  }
}

const facetValues = new Set(materialFacets.map((material) => material.value).filter((value): value is string => Boolean(value)));
const invalidMaterialFacets = materialFacets.filter((facet) => {
  const recipeMaterial = facet.value ? allRecipeMaterials.get(facet.value) : undefined;
  return !recipeMaterial?.materialKey || !filterableMaterialKeys.has(recipeMaterial.materialKey);
});
const linerInMaterialFacets = materialFacets.some((facet) => /insulative liner/i.test(facet.label ?? ""));
const recordsWithInvalidMaterialFacets = browseRecords.filter((record) => {
  const materials = Array.isArray(record.facets?.materials) ? record.facets.materials : [];
  return materials.some((value) => {
    const recipeMaterial = allRecipeMaterials.get(value);
    return !recipeMaterial?.materialKey || !filterableMaterialKeys.has(recipeMaterial.materialKey);
  });
});

if (invalidMaterialFacets.length > 0) {
  throw new Error(`Material facets include non-material recipe inputs: ${invalidMaterialFacets.map((facet) => facet.label ?? facet.value).join(", ")}`);
}
if (recordsWithInvalidMaterialFacets.length > 0) {
  throw new Error(`Browse records include non-material material facets: ${recordsWithInvalidMaterialFacets.slice(0, 5).map((record) => record.id).join(", ")}`);
}
if (linerInMaterialFacets) {
  throw new Error("Insulative Liner is present in material facets.");
}
if (linerRequirementCount === 0) {
  throw new Error("Insulative Liner is missing from recipe requirements.");
}

const browseIds = new Set<string>();
for (const record of browseRecords) {
  if (typeof record.id !== "string" || !record.id.trim()) {
    throw new Error("Browse record is missing id.");
  }
  const normalizedId = record.id.trim().toLowerCase();
  if (browseIds.has(normalizedId)) {
    throw new Error(`Duplicate browse id: ${normalizedId}`);
  }
  browseIds.add(normalizedId);
  if (!recordFiles[normalizedId]) {
    throw new Error(`Browse id ${normalizedId} is missing a by-id file mapping.`);
  }
  if (!record.card || !Array.isArray(record.card.modifierLabels)) {
    throw new Error(`Browse record ${normalizedId} is missing card.modifierLabels array.`);
  }
}

const sampleId = browseRecords[0]?.id?.trim().toLowerCase();
if (!sampleId) {
  throw new Error("Unable to pick a sample browse record.");
}

const checks: Array<{ name: string; run: () => Promise<void> }> = [
  {
    name: "GET /api/crafting/component-cards/index",
    run: async () => {
      const result = await handleComponentCardsRoute("GET", "/api/crafting/component-cards/index");
      if (!result || result.status !== 200) throw new Error(`Unexpected status: ${result?.status ?? "null"}`);
      const body = result.body as { shapedRecordCount?: number; recordIds?: string[] };
      if (body.shapedRecordCount !== 1553) {
        throw new Error(`Expected shapedRecordCount 1553, found ${body.shapedRecordCount ?? 0}.`);
      }
      if (!Array.isArray(body.recordIds) || body.recordIds.length !== 1553) {
        throw new Error(`Expected 1553 recordIds, found ${body.recordIds?.length ?? 0}.`);
      }
    },
  },
  {
    name: "GET /api/crafting/component-cards/facets",
    run: async () => {
      const result = await handleComponentCardsRoute("GET", "/api/crafting/component-cards/facets");
      if (!result || result.status !== 200) throw new Error(`Unexpected status: ${result?.status ?? "null"}`);
      const body = result.body as { facets?: unknown };
      if (!body.facets || typeof body.facets !== "object") {
        throw new Error("Facets route returned invalid payload.");
      }
    },
  },
  {
    name: "GET /api/crafting/component-cards/browse",
    run: async () => {
      const result = await handleComponentCardsRoute("GET", "/api/crafting/component-cards/browse");
      if (!result || result.status !== 200) throw new Error(`Unexpected status: ${result?.status ?? "null"}`);
      const body = result.body as { records?: unknown[] };
      if (!Array.isArray(body.records) || body.records.length !== 1553) {
        throw new Error(`Expected 1553 browse records, found ${body.records?.length ?? 0}.`);
      }
      for (const [index, record] of body.records.entries()) {
        const card = record && typeof record === "object" ? (record as { card?: { modifierLabels?: unknown } }).card : null;
        if (!card || !Array.isArray(card.modifierLabels)) {
          throw new Error(`Browse route record ${index} is missing card.modifierLabels array.`);
        }
      }
    },
  },
  {
    name: `GET /api/crafting/component-cards/${sampleId}`,
    run: async () => {
      const result = await handleComponentCardsRoute(
        "GET",
        `/api/crafting/component-cards/${encodeURIComponent(sampleId)}`,
      );
      if (!result || result.status !== 200) throw new Error(`Unexpected status: ${result?.status ?? "null"}`);
      const body = result.body as { id?: string; source?: unknown; card?: { modifierLabels?: unknown } };
      if (body.id?.trim().toLowerCase() !== sampleId) {
        throw new Error("by-id route returned mismatched record id.");
      }
      if (!body.source || typeof body.source !== "object") {
        throw new Error("by-id route should include full source metadata.");
      }
      if (!body.card || !Array.isArray(body.card.modifierLabels)) {
        throw new Error("by-id route card is missing modifierLabels array.");
      }
      const browseRecord = browseRecords.find((record) => record.id?.trim().toLowerCase() === sampleId);
      if (!browseRecord) throw new Error("Sample browse record missing.");
      if (browseRecord.id !== body.id) throw new Error("Browse/by-id id mismatch.");
    },
  },
];

for (const check of checks) {
  await check.run();
  console.log(`OK ${check.name}`);
}

console.log("Component card shaped data verification passed.");
console.log(`Shaped records: ${shapedCount}`);
console.log(`Material facet count before/after: ${allRecipeMaterials.size}/${materialFacets.length}`);
console.log(`Excluded non-material recipe inputs: ${excludedNonMaterialInputs.size}`);
for (const excluded of [...excludedNonMaterialInputs.values()].slice(0, 20)) {
  console.log(`- ${excluded.label}${excluded.materialKey ? ` (${excluded.materialKey})` : ""}`);
}
console.log(`Unresolved ingredient classifications: ${unresolvedIngredientClassifications.size}`);
console.log(`Insulative Liner present in material facets: ${linerInMaterialFacets ? "yes" : "no"}`);
console.log(`Insulative Liner recipe requirement rows: ${linerRequirementCount}`);
console.log(`Sample id: ${sampleId}`);
