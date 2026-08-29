import type { MaterialTemplate } from "../../types/logistics";
import type { RecipeInputTemplate } from "../../data/logistics/seed";
import { getInventoryUnitLabel } from "./inventory";
import type { MaterialIdentity } from "./materialIdentityIndex";
import {
  createMaterialIdentityResolver,
  isMaterialIdentityGuid,
  normalizeMaterialIdentityToken,
} from "../materialIdentity";

export interface MaterialIdentityInput {
  materialKey?: string | null;
  materialId?: string | null;
  materialGuid?: string | null;
  displayName?: string | null;
  materialName?: string | null;
  rawName?: string | null;
  sourceName?: string | null;
  sourceType?: string | null;
  entityClass?: string | null;
  recordName?: string | null;
  internalName?: string | null;
  costId?: string | null;
}

export interface ResolvedMaterialIdentity {
  materialKey: string;
  materialId: string;
  costId?: string;
  guid?: string;
  displayName: string;
  rawName?: string;
  sourceName?: string;
  sourceType?: string;
  aliasesMatched: string[];
  unitType: "unit" | "SCU";
  category?: MaterialTemplate["materialType"];
  material: MaterialTemplate;
}

function normalizeToken(value: string | null | undefined): string {
  return normalizeMaterialIdentityToken(value);
}

function addAlias(index: Map<string, MaterialTemplate>, alias: string | null | undefined, material: MaterialTemplate) {
  const key = normalizeToken(alias);
  if (key && !index.has(key)) index.set(key, material);
}

export function createMaterialResolver(materials: MaterialTemplate[], materialIdentities: MaterialIdentity[] = []) {
  const index = new Map<string, MaterialTemplate>();
  const materialById = new Map(materials.map((material) => [material.id, material]));
  const identityResolver = createMaterialIdentityResolver(materialIdentities);
  for (const material of materials) {
    addAlias(index, material.id, material);
    addAlias(index, material.name, material);
  }

  return (input: MaterialIdentityInput): ResolvedMaterialIdentity | null => {
    const strongCandidates = [input.materialKey, input.materialId, input.materialGuid, input.costId];
    const aliasCandidates = [input.entityClass, input.recordName, input.internalName, input.sourceName, input.rawName];
    const fallbackCandidates = [input.displayName, input.materialName];
    const orderedCandidates = [...strongCandidates, ...aliasCandidates, ...fallbackCandidates];
    const matches = orderedCandidates
      .map((candidate) => {
        const canonical = identityResolver.resolve(candidate);
        return {
          candidate,
          material: index.get(normalizeToken(candidate)) ?? materialById.get(canonical?.materialKey ?? ""),
        };
      })
      .filter((match): match is { candidate: string; material: MaterialTemplate } => Boolean(match.candidate && match.material));
    const material = matches[0]?.material;
    if (!material) return null;
    const guid = [input.materialGuid, input.costId, input.materialId].find((value) =>
      isMaterialIdentityGuid(value) && identityResolver.resolve(value)?.materialKey === material.id
    ) ?? undefined;
    return {
      materialKey: material.id,
      materialId: material.id,
      costId: guid,
      guid,
      displayName: material.name,
      rawName: input.rawName ?? input.materialName ?? input.displayName ?? input.sourceName ?? undefined,
      sourceName: input.sourceName ?? input.materialName ?? input.rawName ?? undefined,
      sourceType: input.sourceType ?? undefined,
      aliasesMatched: matches.filter((match) => match.material.id === material.id).map((match) => match.candidate),
      unitType: getInventoryUnitLabel(material),
      category: material.materialType,
      material,
    };
  };
}

export function normalizeRecipeInputTemplate(
  input: RecipeInputTemplate,
  materials: MaterialTemplate[],
): RecipeInputTemplate {
  const resolve = createMaterialResolver(materials);
  const resolved = resolve(input);
  if (!resolved) {
    return {
      ...input,
      materialKey: input.materialKey ?? input.materialId,
      displayName: input.displayName ?? input.materialName,
      rawName: input.rawName ?? input.materialName,
    };
  }
  return {
    ...input,
    requirementId: input.requirementId,
    materialKey: resolved.materialKey,
    materialId: resolved.materialId,
    costId: input.costId ?? resolved.costId,
    materialGuid: input.materialGuid ?? resolved.guid,
    displayName: input.displayName ?? input.materialName ?? resolved.displayName,
    materialName: input.materialName ?? input.displayName ?? resolved.displayName,
    rawName: input.rawName ?? resolved.rawName,
    sourceName: input.sourceName ?? resolved.sourceName,
    sourceType: input.sourceType ?? resolved.sourceType,
    unitType: input.unitType ?? resolved.unitType,
  };
}
