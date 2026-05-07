import { readFile } from "node:fs/promises";
import { apiPaths } from "../config/apiPaths";
import type { ApiWarning } from "./warnings";
import { addWarning } from "./warnings";

export interface MaterialIdentityInput {
  materialKey?: string | null;
  materialId?: string | null;
  materialGuid?: string | null;
  costId?: string | null;
  materialName?: string | null;
  displayName?: string | null;
  rawName?: string | null;
  sourceName?: string | null;
  sourceType?: string | null;
  unitType?: "unit" | "SCU" | "scu" | "cscu";
}

export interface ResolvedApiMaterial {
  materialId: string;
  materialName: string;
  unitType?: "unit" | "SCU" | "scu" | "cscu";
}

const GUID_ALIASES: Record<string, string> = {
  "d7a21cac-3c2b-4695-95b7-2042d8f5755e": "feynmaline",
  "f9f3251a-8e48-408a-b957-f1e3d5d3e213": "rawice",
};

function normalizeToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/^entityclassdefinition\./, "").replace(/[^a-z0-9]/g, "");
}

async function loadPublicMaterialIndex(warnings: ApiWarning[]) {
  const index = new Map<string, ResolvedApiMaterial>();
  const add = (key: string | null | undefined, material: ResolvedApiMaterial) => {
    const normalized = normalizeToken(key);
    if (normalized && !index.has(normalized)) index.set(normalized, material);
  };

  try {
    const scores = JSON.parse(await readFile(apiPaths.materialSourceScores, "utf8")) as {
      materials?: Array<{ materialId?: string; materialName?: string }>;
    };
    for (const material of scores.materials ?? []) {
      if (!material.materialName && !material.materialId) continue;
      const resolved = {
        materialId: material.materialId ?? material.materialName ?? "",
        materialName: material.materialName ?? material.materialId ?? "",
      };
      add(resolved.materialId, resolved);
      add(resolved.materialName, resolved);
    }
  } catch (error) {
    addWarning(warnings, {
      code: "api_material_index_unreadable",
      message: `Unable to load material source scores for material resolution: ${error instanceof Error ? error.message : String(error)}`,
      path: "public/api/recommendations/material_source_scores.json",
    });
  }

  try {
    const enriched = JSON.parse(await readFile(apiPaths.materialSourcesQualityEnriched, "utf8")) as Array<{
      materialId?: string;
      materialName?: string;
      sources?: Array<{ spawnType?: string }>;
    }>;
    for (const material of enriched) {
      if (!material.materialName && !material.materialId) continue;
      const hasOnlyShipSources = (material.sources ?? []).some((source) => source.spawnType?.toLowerCase().includes("ship"));
      const resolved = {
        materialId: material.materialId ?? material.materialName ?? "",
        materialName: material.materialName ?? material.materialId ?? "",
        unitType: hasOnlyShipSources ? "SCU" as const : undefined,
      };
      add(resolved.materialId, resolved);
      add(resolved.materialName, resolved);
    }
  } catch (error) {
    addWarning(warnings, {
      code: "api_material_index_unreadable",
      message: `Unable to load enriched mining sources for material resolution: ${error instanceof Error ? error.message : String(error)}`,
      path: "public/api/mining/material_sources_quality_enriched.json",
    });
  }

  for (const [guid, id] of Object.entries(GUID_ALIASES)) {
    const material = index.get(normalizeToken(id));
    if (material) add(guid, material);
  }

  return index;
}

export async function createApiMaterialResolver(warnings: ApiWarning[]) {
  const index = await loadPublicMaterialIndex(warnings);

  return (input: MaterialIdentityInput): ResolvedApiMaterial | null => {
    const candidates = [
      input.materialKey,
      input.materialId,
      input.materialGuid,
      input.costId,
      input.sourceName,
      input.rawName,
      input.materialName,
      input.displayName,
    ];
    for (const candidate of candidates) {
      const aliased = GUID_ALIASES[(candidate ?? "").toLowerCase()] ?? candidate;
      const match = index.get(normalizeToken(aliased));
      if (match) {
        return {
          ...match,
          unitType: input.unitType ?? match.unitType,
        };
      }
    }
    return null;
  };
}
