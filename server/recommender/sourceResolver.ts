import type { ApiSource, MaterialSourceGroup, RecommenderWarning } from "./recommender.types";
import { addWarning } from "./recommenderWarnings";

const OVERRIDE_FIELDS = ["locationOverrides", "perLocationOverrides", "locations", "providers"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sourceLocationKey(source: Pick<ApiSource, "system" | "location" | "providerGuid" | "providerName">): string {
  return [
    source.system,
    source.location,
    source.providerGuid,
    source.providerName,
  ].filter(Boolean).join("|").toLowerCase();
}

function stampSource(source: ApiSource, group: MaterialSourceGroup, sourceResolverPath: string): ApiSource {
  return {
    ...source,
    materialId: source.materialId ?? group.materialId,
    materialName: source.materialName ?? group.materialName,
    sourceResolverPath: source.sourceResolverPath ?? sourceResolverPath,
    perLocationOverrideApplied: source.perLocationOverrideApplied ?? false,
    overrideFieldsApplied: source.overrideFieldsApplied ?? [],
    sourceLocationRawName: source.sourceLocationRawName ?? source.location ?? source.providerName,
    sourceLocationKey: source.sourceLocationKey ?? sourceLocationKey(source),
  };
}

function overrideMatchesSource(override: Record<string, unknown>, source: ApiSource): boolean {
  const providerGuid = typeof override.providerGuid === "string" ? override.providerGuid : undefined;
  const providerName = typeof override.providerName === "string" ? override.providerName : undefined;
  const location = typeof override.location === "string" ? override.location : undefined;
  const system = typeof override.system === "string" ? override.system : undefined;

  return Boolean(
    (providerGuid && source.providerGuid === providerGuid) ||
    (providerName && source.providerName === providerName) ||
    (location && system && source.location === location && source.system === system) ||
    (location && !system && source.location === location)
  );
}

function applyOverride(source: ApiSource, override: Record<string, unknown>, sourceResolverPath: string): ApiSource {
  return {
    ...source,
    ...override,
    quality: isRecord(override.quality) ? {
      ...(source.quality ?? {}),
      ...override.quality,
    } as ApiSource["quality"] : source.quality,
    composition: isRecord(override.composition) ? {
      ...(source.composition ?? {}),
      ...override.composition,
    } as ApiSource["composition"] : source.composition,
    sourceResolverPath,
    perLocationOverrideApplied: true,
    overrideFieldsApplied: Object.keys(override),
    sourceLocationRawName: typeof override.location === "string" ? override.location : source.location ?? source.providerName,
    sourceLocationKey: sourceLocationKey({
      system: typeof override.system === "string" ? override.system : source.system,
      location: typeof override.location === "string" ? override.location : source.location,
      providerGuid: typeof override.providerGuid === "string" ? override.providerGuid : source.providerGuid,
      providerName: typeof override.providerName === "string" ? override.providerName : source.providerName,
    }),
  } as ApiSource;
}

function resolveOverrideSources(group: MaterialSourceGroup, baseSources: ApiSource[], warnings: RecommenderWarning[]): ApiSource[] {
  const resolved: ApiSource[] = [];

  for (const field of OVERRIDE_FIELDS) {
    const overrides = Array.isArray(group[field]) ? group[field] : [];
    for (const overrideValue of overrides) {
      if (!isRecord(overrideValue)) {
        addWarning(warnings, {
          code: "source_override_unreadable",
          message: `A ${field} entry for ${group.materialName ?? group.materialId ?? "unknown material"} was not an object and was skipped.`,
          materialId: group.materialId,
          materialName: group.materialName,
        });
        continue;
      }

      const matchingSource = baseSources.find((source) => overrideMatchesSource(overrideValue, source));
      if (matchingSource) {
        resolved.push(applyOverride(matchingSource, overrideValue, field));
        continue;
      }

      const overrideSource = applyOverride({
        materialId: group.materialId,
        materialName: group.materialName,
      }, overrideValue, field);
      if (!overrideSource.system && !overrideSource.location && !overrideSource.providerName && !overrideSource.providerGuid) {
        addWarning(warnings, {
          code: "source_override_location_unresolved",
          message: `A ${field} entry for ${group.materialName ?? group.materialId ?? "unknown material"} did not include location/provider fields and was skipped.`,
          materialId: group.materialId,
          materialName: group.materialName,
        });
        continue;
      }
      resolved.push(overrideSource);
    }
  }

  return resolved;
}

export function resolveSources(group: MaterialSourceGroup, warnings: RecommenderWarning[]): ApiSource[] {
  const sourceResolverPath = group.bestSources ? "bestSources" : "sources";
  const sources = (group.bestSources ?? group.sources ?? []).map((source) => stampSource(source, group, sourceResolverPath));
  const overrideSources = resolveOverrideSources(group, sources, warnings);
  const resolvedSources = [...sources, ...overrideSources];
  if (resolvedSources.length === 0) {
    addWarning(warnings, {
      code: "material_sources_empty",
      message: `No source rows were available for ${group.materialName ?? group.materialId ?? "unknown material"}.`,
      materialId: group.materialId,
      materialName: group.materialName,
    });
  }
  return resolvedSources;
}
