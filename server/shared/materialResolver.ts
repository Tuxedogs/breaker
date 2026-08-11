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

type MaterialIdentityIndexEntry = {
  materialKey?: string;
  canonicalName?: string;
  displayName?: string;
  rawName?: string;
  refinedName?: string;
  commodityName?: string;
  unitType?: "unit" | "SCU" | "scu" | "cscu";
  isRefinable?: boolean;
  refinesToMaterialKey?: string | null;
  aliases?: Record<string, string[]> | string[];
};

export interface ResolvedApiMaterial {
  materialKey: string;
  materialId: string;
  materialName: string;
  displayName: string;
  normalizedName: string;
  slug: string;
  unitType?: "unit" | "SCU" | "scu" | "cscu";
}

const GUID_ALIASES: Record<string, string> = {
  "d7a21cac-3c2b-4695-95b7-2042d8f5755e": "feynmaline",
  "8cd317a3-df9b-4315-8ac3-0f1fca42dfd4": "stileron",
  "f9f3251a-8e48-408a-b957-f1e3d5d3e213": "rawice",
};

function normalizeToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/^entityclassdefinition\./, "").replace(/[^a-z0-9]/g, "");
}

function slugify(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^entityclassdefinition\./, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolvedMaterial(input: {
  materialId?: string;
  materialName?: string;
  unitType?: "unit" | "SCU" | "scu" | "cscu";
}): ResolvedApiMaterial {
  const materialId = input.materialId ?? input.materialName ?? "";
  const displayName = input.materialName ?? input.materialId ?? "";
  const normalizedName = normalizeToken(displayName);
  return {
    materialKey: materialId,
    materialId,
    materialName: displayName,
    displayName,
    normalizedName,
    slug: slugify(displayName || materialId),
    unitType: input.unitType,
  };
}

async function loadMaterialIndex(warnings: ApiWarning[]) {
  const index = new Map<string, ResolvedApiMaterial>();
  const add = (key: string | null | undefined, material: ResolvedApiMaterial) => {
    const normalized = normalizeToken(key);
    if (normalized && !index.has(normalized)) index.set(normalized, material);
  };

  try {
    const enriched = JSON.parse(await readFile(apiPaths.materialSourcesQualityEnriched, "utf8")) as Array<{
      materialId?: string;
      materialName?: string;
      sources?: Array<{ spawnType?: string }>;
    }>;
    for (const material of enriched) {
      if (!material.materialName && !material.materialId) continue;
      const hasOnlyShipSources = (material.sources ?? []).some((source) => source.spawnType?.toLowerCase().includes("ship"));
      const resolved = resolvedMaterial({
        materialId: material.materialId ?? material.materialName ?? "",
        materialName: material.materialName ?? material.materialId ?? "",
        unitType: hasOnlyShipSources ? "SCU" as const : undefined,
      });
      add(resolved.materialId, resolved);
      add(resolved.materialName, resolved);
      add(resolved.displayName, resolved);
      add(resolved.slug, resolved);
    }
  } catch (error) {
    addWarning(warnings, {
      code: "api_material_index_unreadable",
      message: `Unable to load enriched mining sources for material resolution: ${error instanceof Error ? error.message : String(error)}`,
      path: "server-data/mining/recommender/material-sources-quality-enriched.json",
    });
  }

  try {
    const scores = JSON.parse(await readFile(apiPaths.materialSourceScores, "utf8")) as {
      materials?: Array<{ materialId?: string; materialName?: string }>;
    };
    for (const material of scores.materials ?? []) {
      if (!material.materialName && !material.materialId) continue;
      const resolved = resolvedMaterial({
        materialId: material.materialId ?? material.materialName ?? "",
        materialName: material.materialName ?? material.materialId ?? "",
      });
      add(resolved.materialId, resolved);
      add(resolved.materialName, resolved);
      add(resolved.displayName, resolved);
      add(resolved.slug, resolved);
    }
  } catch (error) {
    addWarning(warnings, {
      code: "api_material_index_unreadable",
      message: `Unable to load material source scores for material resolution: ${error instanceof Error ? error.message : String(error)}`,
      path: "server-data/mining/recommender/material-source-scores.json",
    });
  }

  for (const [guid, id] of Object.entries(GUID_ALIASES)) {
    const material = index.get(normalizeToken(id));
    if (material) add(guid, material);
  }

  try {
    const identityIndex = JSON.parse(await readFile(apiPaths.materialIdentityIndex, "utf8")) as {
      materials?: MaterialIdentityIndexEntry[];
    };
    const sourceKeyByOutput = new Map<string, string>();
    for (const identity of identityIndex.materials ?? []) {
      if (identity.materialKey && identity.isRefinable && identity.refinesToMaterialKey) {
        sourceKeyByOutput.set(identity.refinesToMaterialKey, identity.materialKey);
      }
    }
    for (const identity of identityIndex.materials ?? []) {
      if (!identity.materialKey) continue;
      const sourceKey = sourceKeyByOutput.get(identity.materialKey);
      const isRawSource = identity.materialKey.startsWith("raw");
      if (sourceKey === "rawice" || (isRawSource && identity.materialKey !== "rawice")) continue;
      const material = resolvedMaterial({
        materialId: identity.materialKey,
        materialName: identity.canonicalName ?? identity.rawName ?? identity.displayName ?? identity.materialKey,
        unitType: identity.unitType === "unit" || identity.unitType === "SCU" || identity.unitType === "scu" || identity.unitType === "cscu"
          ? identity.unitType
          : undefined,
      });
      add(material.materialId, material);
      add(material.materialName, material);
    }
    for (const identity of identityIndex.materials ?? []) {
      const materialKey = identity.materialKey;
      const material = index.get(normalizeToken(sourceKeyByOutput.get(materialKey ?? ""))) ??
        index.get(normalizeToken(materialKey));
      if (!material) continue;
      add(identity.materialKey, material);
      add(identity.canonicalName, material);
      add(identity.displayName, material);
      add(identity.rawName, material);
      add(identity.refinedName, material);
      add(identity.commodityName, material);
      if (Array.isArray(identity.aliases)) {
        for (const alias of identity.aliases) add(alias, material);
      } else {
        for (const values of Object.values(identity.aliases ?? {})) {
          for (const alias of values) add(alias, material);
        }
      }
    }
  } catch (error) {
    addWarning(warnings, {
      code: "api_material_index_unreadable",
      message: `Unable to load crafting material identity index for material aliases: ${error instanceof Error ? error.message : String(error)}`,
      path: "server-data/crafting/reference/material-identity-index.json",
    });
  }

  return index;
}

export async function createApiMaterialResolver(warnings: ApiWarning[]) {
  const index = await loadMaterialIndex(warnings);

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
