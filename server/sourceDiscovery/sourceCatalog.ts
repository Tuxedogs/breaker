import { projectJournalHabitats } from "./journalEvidence.js";
import type { JournalCatalogEvidence, JournalHabitatDataset } from "./journalEvidence.js";

export type SourceCategory = "mineable" | "hand_harvestable" | "wildlife";
export type SourceCategoryAvailability = "present" | "unknown";
export type SourceLocationEvidence = "exact" | "parent_only" | "unknown";
export type SourceConfidence = "high" | "medium" | "low" | "unknown";

type PublishedMiningSource = {
  providerGuid?: string;
  providerName?: string;
  harvestableGuid?: string;
  harvestableName?: string;
  compositionGuid?: string;
  entityClass?: string;
  mineableEntity?: string;
  spawnType?: string;
  groupName?: string;
  system?: string;
  location?: string;
  locationType?: string;
  sourceLocationId?: string | null;
  sourceLocationParentIds?: string[];
  systemLocationId?: string | null;
  groupProbability?: number;
  relativeProbability?: number;
  materialProbability?: number;
  probability?: number;
  locationResolution?: {
    method?: string;
    confidence?: string;
    providerAmbiguous?: boolean;
  };
};

export type PublishedMiningMaterialGroup = {
  materialId?: string;
  materialName?: string;
  primaryMaterialKey?: string;
  sources?: PublishedMiningSource[];
};

export type SourceCatalogRecord = {
  id: string;
  category: "mineable";
  recordStatus: "present";
  deliveredMaterial: {
    materialId: string | null;
    materialKey: string | null;
    materialName: string | null;
  };
  source: {
    providerGuid: string | null;
    providerName: string | null;
    harvestableGuid: string | null;
    harvestableName: string | null;
    compositionGuid: string | null;
    entityClass: string | null;
    mineableEntity: string | null;
    spawnType: string | null;
    groupName: string | null;
  };
  location: {
    evidence: SourceLocationEvidence;
    sourceLocationId: string | null;
    sourceLocationParentIds: string[];
    systemLocationId: string | null;
    system: string | null;
    location: string | null;
    locationType: string | null;
  };
  competitionPool: {
    quantified: boolean;
    groupProbability: number | null;
    relativeProbability: number | null;
    materialProbability: number | null;
    probability: number | null;
  };
  provenance: {
    source: "published_scintel_mining_registry";
    locationResolution: {
      status: "present" | "unknown";
      method: string | null;
      confidence: SourceConfidence;
      providerAmbiguous: boolean | null;
    };
  };
};

export type SourceCatalog = {
  schemaVersion: 1;
  source: {
    registryPath: "server-data/mining/recommender/material-sources-quality-enriched.json";
    dataset: { status: "unknown"; version: null };
  };
  categories: Record<SourceCategory, { availability: SourceCategoryAvailability }>;
  records: SourceCatalogRecord[];
  journal: JournalCatalogEvidence;
};

function stringOrNull(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function finiteNumberOrNull(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sourceLocationEvidence(source: PublishedMiningSource): SourceLocationEvidence {
  // "exact" means that the published source has a source-location record ID.
  // It does not claim an exact physical spawn coordinate or volume.
  if (stringOrNull(source.sourceLocationId)) return "exact";
  if ((source.sourceLocationParentIds ?? []).some((parentId) => Boolean(stringOrNull(parentId)))) return "parent_only";
  return "unknown";
}

function confidence(value: string | undefined): SourceConfidence {
  switch (value?.trim().toLowerCase()) {
    case "high":
    case "medium":
    case "low":
      return value.trim().toLowerCase() as Exclude<SourceConfidence, "unknown">;
    default:
      return "unknown";
  }
}

function sourceRecordId(materialId: string | null, source: PublishedMiningSource): string {
  const values = [
    materialId ?? stringOrNull(source.system),
    stringOrNull(source.providerGuid) ?? stringOrNull(source.providerName),
    stringOrNull(source.harvestableGuid) ?? stringOrNull(source.harvestableName),
    stringOrNull(source.compositionGuid),
    stringOrNull(source.entityClass),
    stringOrNull(source.sourceLocationId) ?? stringOrNull(source.systemLocationId) ?? stringOrNull(source.location),
  ];
  if (values.every((value) => value === null)) throw new Error("Mining source cannot form a stable Source catalog ID.");
  return `mineable:${values.map((value) => value ?? "unknown").join(":")}`;
}

/**
 * Projects the already-published mining registry for server consumers. It does
 * not extract, normalize, or infer new game data.
 */
export function buildSourceCatalog(materialGroups: PublishedMiningMaterialGroup[], journalDataset?: JournalHabitatDataset): SourceCatalog {
  const records: SourceCatalogRecord[] = [];
  const recordIds = new Set<string>();

  for (const group of materialGroups) {
    const materialId = stringOrNull(group.materialId);
    for (const source of group.sources ?? []) {
      const id = sourceRecordId(materialId, source);
      if (recordIds.has(id)) throw new Error(`Duplicate Source catalog record ID: ${id}`);
      recordIds.add(id);

      const resolution = source.locationResolution;
      records.push({
        id,
        category: "mineable",
        recordStatus: "present",
        deliveredMaterial: {
          materialId,
          materialKey: stringOrNull(group.primaryMaterialKey),
          materialName: stringOrNull(group.materialName),
        },
        source: {
          providerGuid: stringOrNull(source.providerGuid),
          providerName: stringOrNull(source.providerName),
          harvestableGuid: stringOrNull(source.harvestableGuid),
          harvestableName: stringOrNull(source.harvestableName),
          compositionGuid: stringOrNull(source.compositionGuid),
          entityClass: stringOrNull(source.entityClass),
          mineableEntity: stringOrNull(source.mineableEntity),
          spawnType: stringOrNull(source.spawnType),
          groupName: stringOrNull(source.groupName),
        },
        location: {
          evidence: sourceLocationEvidence(source),
          sourceLocationId: stringOrNull(source.sourceLocationId),
          sourceLocationParentIds: (source.sourceLocationParentIds ?? []).map(stringOrNull).filter((value): value is string => value !== null),
          systemLocationId: stringOrNull(source.systemLocationId),
          system: stringOrNull(source.system),
          location: stringOrNull(source.location),
          locationType: stringOrNull(source.locationType),
        },
        competitionPool: {
          quantified: [source.groupProbability, source.relativeProbability, source.materialProbability, source.probability]
            .every((value) => finiteNumberOrNull(value) !== null),
          groupProbability: finiteNumberOrNull(source.groupProbability),
          relativeProbability: finiteNumberOrNull(source.relativeProbability),
          materialProbability: finiteNumberOrNull(source.materialProbability),
          probability: finiteNumberOrNull(source.probability),
        },
        provenance: {
          source: "published_scintel_mining_registry",
          locationResolution: {
            status: resolution ? "present" : "unknown",
            method: stringOrNull(resolution?.method),
            confidence: confidence(resolution?.confidence),
            providerAmbiguous: typeof resolution?.providerAmbiguous === "boolean" ? resolution.providerAmbiguous : null,
          },
        },
      });
    }
  }

  records.sort((left, right) => left.id.localeCompare(right.id));
  return {
    schemaVersion: 1,
    source: {
      registryPath: "server-data/mining/recommender/material-sources-quality-enriched.json",
      dataset: { status: "unknown", version: null },
    },
    categories: {
      mineable: { availability: records.length > 0 ? "present" : "unknown" },
      hand_harvestable: { availability: "unknown" },
      wildlife: { availability: "unknown" },
    },
    records,
    journal: projectJournalHabitats(journalDataset),
  };
}
