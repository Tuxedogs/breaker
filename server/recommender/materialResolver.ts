import type { AggregatedRequirement, MaterialSourceGroup, RecommenderWarning } from "./recommender.types";
import { addWarning } from "./recommenderWarnings";

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function compactMaterialKey(value: string | undefined): string {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

const MATERIAL_ALIASES = new Map<string, string>([
  ["93c8b7dfd6ac4b4fa115b0e3afc238b8", "beryl"],
  ["f386a33cac9a400aa7b8fe1fc7c8d270", "iron"],
  ["8cd317a3df9b43158ac30f1fca42dfd4", "stileron"],
  ["6426f04e2f7d4c8ea61564aa582eaa31", "savrilium"],
  ["quantanium", "quantanium"],
  ["quantainium", "quantanium"],
  ["savrilium", "savrilium"],
  ["savrillium", "savrilium"],
  ["savrilum", "savrilium"],
  ["hephaestonite", "hephaestanite"],
  ["hephaestanite", "hephaestanite"],
  ["hephaestonice", "hephaestanite"],
]);

const CANONICAL_DISPLAY_NAMES = new Map<string, string>([
  ["quantanium", "Quantanium"],
  ["savrilium", "Savrilium"],
  ["hephaestanite", "Hephaestanite"],
]);

function materialAliasVariants(canonicalKey: string): string[] {
  if (canonicalKey === "quantanium") return ["quantanium", "quantainium"];
  return [canonicalKey];
}

export function canonicalMaterialKey(value: string | undefined): string {
  const compact = compactMaterialKey(value);
  return MATERIAL_ALIASES.get(compact) ?? compact;
}

export function canonicalMaterialDisplayName(value: string | undefined): string {
  const key = canonicalMaterialKey(value);
  return CANONICAL_DISPLAY_NAMES.get(key) ?? (value ?? "").trim();
}

function sourceContainsMaterialAlias(group: MaterialSourceGroup, aliasKey: string): boolean {
  const sources = group.bestSources ?? group.sources ?? [];
  const variants = materialAliasVariants(aliasKey);
  return sources.some((source) => [
    source.materialId,
    source.materialName,
    source.harvestableName,
    source.mineableEntity,
    source.compositionName,
    source.entityClass,
    source.providerName,
    source.groupName,
  ].some((value) => canonicalMaterialKey(value) === aliasKey || variants.some((variant) => compactMaterialKey(value).includes(variant))));
}

export function findMaterialGroup(
  requirement: AggregatedRequirement,
  groups: MaterialSourceGroup[],
  warnings: RecommenderWarning[],
): MaterialSourceGroup | null {
  const requirementAliasKey = canonicalMaterialKey(requirement.materialKey || requirement.materialId || requirement.materialName || requirement.displayName);
  const byKey = groups.find((group) => group.materialId === requirement.materialKey);
  if (byKey) return byKey;
  const byId = groups.find((group) => group.materialId === requirement.materialId);
  if (byId) return byId;
  const byName = groups.find((group) =>
    normalize(group.materialName) === normalize(requirement.displayName) ||
    normalize(group.materialName) === normalize(requirement.materialName) ||
    canonicalMaterialKey(group.materialName) === requirementAliasKey
  );
  if (byName) return byName;

  const aliasSources = groups.flatMap((group) => {
    if (!sourceContainsMaterialAlias(group, requirementAliasKey)) return [];
    const variants = materialAliasVariants(requirementAliasKey);
    return (group.bestSources ?? group.sources ?? [])
      .filter((source) => [
        source.materialId,
        source.materialName,
        source.harvestableName,
        source.mineableEntity,
        source.compositionName,
        source.entityClass,
        source.providerName,
        source.groupName,
      ].some((value) =>
        canonicalMaterialKey(value) === requirementAliasKey ||
        variants.some((variant) => compactMaterialKey(value).includes(variant))
      ))
      .map((source) => ({
        ...source,
        originalMaterialName: group.materialName,
        originalMaterialKey: group.materialId,
        materialName: canonicalMaterialDisplayName(requirement.materialName),
        materialId: requirement.materialId,
        canonicalMaterialName: canonicalMaterialDisplayName(requirement.materialName),
        canonicalMaterialKey: requirementAliasKey,
        materialAliasApplied: true,
      }));
  });

  if (aliasSources.length > 0) {
    return {
      materialId: requirement.materialId,
      materialName: canonicalMaterialDisplayName(requirement.materialName),
      sources: aliasSources,
    };
  }

  addWarning(warnings, {
    code: "material_sources_missing",
    message: `No API source group found for ${requirement.materialName}.`,
    materialId: requirement.materialId,
    materialName: requirement.materialName,
    path: "public/api/recommendations/material_source_scores.json:materials",
  });
  return null;
}
