import {
  DEFAULT_MATERIAL_IDENTITY_RESOLVER,
  type MaterialIdentityResolver,
} from "../../src/lib/materialIdentity.js";
import type { AggregatedRequirement, MaterialSourceGroup, RecommenderWarning } from "./recommender.types.js";
import { addWarning } from "./recommenderWarnings.js";

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function compactMaterialKey(value: string | undefined): string {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

export function canonicalMaterialKey(
  value: string | undefined,
  identityResolver: MaterialIdentityResolver = DEFAULT_MATERIAL_IDENTITY_RESOLVER,
): string {
  return identityResolver.canonicalKey(value);
}

export function canonicalMaterialDisplayName(
  value: string | undefined,
  identityResolver: MaterialIdentityResolver = DEFAULT_MATERIAL_IDENTITY_RESOLVER,
): string {
  return identityResolver.canonicalDisplayName(value);
}

function sourceContainsMaterialAlias(
  group: MaterialSourceGroup,
  aliasKey: string,
  identityResolver: MaterialIdentityResolver,
): boolean {
  const sources = group.bestSources ?? group.sources ?? [];
  const variants = identityResolver.aliasesFor(aliasKey).filter((alias) => alias.length > 0);
  return sources.some((source) => [
    source.materialId,
    source.materialName,
    source.harvestableName,
    source.mineableEntity,
    source.compositionName,
    source.entityClass,
    source.providerName,
    source.groupName,
  ].some((value) =>
    canonicalMaterialKey(value, identityResolver) === aliasKey
    || variants.some((variant) => compactMaterialKey(value).includes(variant))
  ));
}

export function findMaterialGroup(
  requirement: AggregatedRequirement,
  groups: MaterialSourceGroup[],
  warnings: RecommenderWarning[],
  identityResolver: MaterialIdentityResolver = DEFAULT_MATERIAL_IDENTITY_RESOLVER,
): MaterialSourceGroup | null {
  const requirementAliasKey = canonicalMaterialKey(
    requirement.materialKey || requirement.materialId || requirement.materialName || requirement.displayName,
    identityResolver,
  );
  const byKey = groups.find((group) => canonicalMaterialKey(group.materialId, identityResolver) === requirementAliasKey);
  if (byKey) return byKey;
  const byName = groups.find((group) =>
    normalize(group.materialName) === normalize(requirement.displayName)
    || normalize(group.materialName) === normalize(requirement.materialName)
    || canonicalMaterialKey(group.materialName, identityResolver) === requirementAliasKey
  );
  if (byName) return byName;

  const aliasSources = groups.flatMap((group) => {
    if (!sourceContainsMaterialAlias(group, requirementAliasKey, identityResolver)) return [];
    const variants = identityResolver.aliasesFor(requirementAliasKey).filter((alias) => alias.length > 0);
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
        canonicalMaterialKey(value, identityResolver) === requirementAliasKey
        || variants.some((variant) => compactMaterialKey(value).includes(variant))
      ))
      .map((source) => ({
        ...source,
        originalMaterialName: group.materialName,
        originalMaterialKey: group.materialId,
        materialName: canonicalMaterialDisplayName(requirement.materialName, identityResolver),
        materialId: requirement.materialId,
        canonicalMaterialName: canonicalMaterialDisplayName(requirement.materialName, identityResolver),
        canonicalMaterialKey: requirementAliasKey,
        materialAliasApplied: true,
      }));
  });

  if (aliasSources.length > 0) {
    return {
      materialId: requirement.materialId,
      materialName: canonicalMaterialDisplayName(requirement.materialName, identityResolver),
      sources: aliasSources,
    };
  }

  addWarning(warnings, {
    code: "material_sources_missing",
    message: `No API source group found for ${requirement.materialName}.`,
    materialId: requirement.materialId,
    materialName: requirement.materialName,
    path: "server-data/mining/recommender/material-source-scores.json:materials",
  });
  return null;
}
