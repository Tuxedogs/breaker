import { readFile } from "node:fs/promises";

import { apiPaths } from "../config/apiPaths";
import {
  MATERIAL_IDENTITY_OVERRIDES,
  createMaterialIdentityResolver,
  normalizeMaterialIdentityToken,
  type MaterialIdentityRecord,
  type MaterialIdentityUnitType,
} from "../../src/lib/materialIdentity";
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
  unitType?: MaterialIdentityUnitType;
}

export interface ResolvedApiMaterial {
  materialKey: string;
  materialId: string;
  materialName: string;
  displayName: string;
  normalizedName: string;
  slug: string;
  unitType?: MaterialIdentityUnitType;
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
  materialId: string;
  materialName: string;
  unitType?: MaterialIdentityUnitType;
}): ResolvedApiMaterial {
  return {
    materialKey: input.materialId,
    materialId: input.materialId,
    materialName: input.materialName,
    displayName: input.materialName,
    normalizedName: normalizeMaterialIdentityToken(input.materialName),
    slug: slugify(input.materialName || input.materialId),
    unitType: input.unitType,
  };
}

async function loadMaterialIndex(warnings: ApiWarning[]) {
  let identities: MaterialIdentityRecord[] = [];
  try {
    const identityIndex = JSON.parse(await readFile(apiPaths.materialIdentityIndex, "utf8")) as {
      materials?: MaterialIdentityRecord[];
    };
    identities = (identityIndex.materials ?? []).filter((identity) => Boolean(identity.materialKey));
  } catch (error) {
    addWarning(warnings, {
      code: "api_material_index_unreadable",
      message: `Unable to load crafting material identity index for material aliases: ${error instanceof Error ? error.message : String(error)}`,
      path: "server-data/crafting/reference/material-identity-index.json",
    });
  }

  const identityResolver = createMaterialIdentityResolver(identities);
  const materialByKey = new Map<string, ResolvedApiMaterial>();
  const supplementalAliases = new Map<string, ResolvedApiMaterial>();

  const addSupplementalAlias = (value: string | null | undefined, material: ResolvedApiMaterial) => {
    const token = normalizeMaterialIdentityToken(value);
    if (token && !supplementalAliases.has(token)) supplementalAliases.set(token, material);
  };

  const addCanonicalMaterial = (materialKey: string, displayName: string, unitType?: MaterialIdentityUnitType) => {
    const existing = materialByKey.get(materialKey);
    const material = resolvedMaterial({
      materialId: materialKey,
      materialName: existing?.materialName ?? displayName,
      unitType: existing?.unitType ?? unitType,
    });
    materialByKey.set(materialKey, material);
    addSupplementalAlias(materialKey, material);
    addSupplementalAlias(displayName, material);
    return material;
  };

  for (const identity of identities) {
    const canonical = identityResolver.resolve(identity.materialKey);
    if (!canonical) continue;
    addCanonicalMaterial(canonical.materialKey, canonical.displayName, canonical.unitType);
  }
  for (const override of MATERIAL_IDENTITY_OVERRIDES) {
    addCanonicalMaterial(override.materialKey, override.displayName);
  }

  const addSourceMaterial = (input: {
    materialId?: string;
    materialName?: string;
    unitType?: MaterialIdentityUnitType;
  }) => {
    if (!input.materialName && !input.materialId) return;
    const canonical = identityResolver.resolve(input.materialId) ?? identityResolver.resolve(input.materialName);
    const materialKey = canonical?.materialKey ?? input.materialId ?? input.materialName ?? "";
    const displayName = canonical?.displayName ?? input.materialName ?? input.materialId ?? materialKey;
    const material = addCanonicalMaterial(materialKey, displayName, input.unitType);
    addSupplementalAlias(input.materialId, material);
    addSupplementalAlias(input.materialName, material);
  };

  try {
    const enriched = JSON.parse(await readFile(apiPaths.materialSourcesQualityEnriched, "utf8")) as Array<{
      materialId?: string;
      materialName?: string;
      sources?: Array<{ spawnType?: string }>;
    }>;
    for (const material of enriched) {
      const hasShipSources = (material.sources ?? []).some((source) => source.spawnType?.toLowerCase().includes("ship"));
      addSourceMaterial({
        materialId: material.materialId,
        materialName: material.materialName,
        unitType: hasShipSources ? "SCU" : undefined,
      });
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
    for (const material of scores.materials ?? []) addSourceMaterial(material);
  } catch (error) {
    addWarning(warnings, {
      code: "api_material_index_unreadable",
      message: `Unable to load material source scores for material resolution: ${error instanceof Error ? error.message : String(error)}`,
      path: "server-data/mining/recommender/material-source-scores.json",
    });
  }

  return { identityResolver, materialByKey, supplementalAliases };
}

export async function createApiMaterialResolver(warnings: ApiWarning[]) {
  const { identityResolver, materialByKey, supplementalAliases } = await loadMaterialIndex(warnings);

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
      const canonical = identityResolver.resolve(candidate);
      const match = materialByKey.get(canonical?.materialKey ?? "")
        ?? supplementalAliases.get(normalizeMaterialIdentityToken(candidate));
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
