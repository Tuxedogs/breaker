import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Cross-dataset consistency for the published server-data registries.
 *
 * Checks the joins that exist today: mission pointer -> generation, mission
 * source -> generation, generation -> reference index build, and
 * blueprint-sources -> mission generation, variants, offers, and recipes.
 * Datasets that do not record a build identity are reported as unrecorded,
 * not guessed.
 */

type JsonObject = Record<string, unknown>;

export type DatasetConsistencyIssue = { code: string; message: string; count?: number; examples?: string[] };

export type DatasetConsistencyReport = {
  schemaVersion: 1;
  ok: boolean;
  datasets: {
    missions: {
      pointerGenerationId: string | null;
      tuple: string | null;
      sourceBuildId: string | null;
      sourceLatestModifiedAt: string | null;
      generationSourceLatestModifiedAt: string | null;
      refIndexBuildId: string | null;
      refIndexStatus: string | null;
      variantCount: number;
      catalogContractCount: number;
      catalogBlueprintContractCount: number;
    };
    blueprintSources: {
      missionGenerationId: string | null;
      sourceLatestModifiedAt: string | null;
      blueprintFileCount: number;
      missionFileCount: number;
      generatedAt: string | null;
    };
    craftingRecipes: { buildIdentity: "unrecorded"; sourceGeneratedAt: string | null; blueprintCount: number };
    componentCards: { buildIdentity: "unrecorded"; sourceGeneratedAt: string | null };
    fitting: { currentBuildIds: Record<string, string>; missingBuildDirectories: string[] };
  };
  links: {
    blueprintSourceContractIds: number;
    blueprintSourceOfferKeys: number;
    blueprintGuids: number;
    unresolvedContractIds: number;
    unresolvedOfferKeys: number;
    blueprintGuidsWithoutRecipe: number;
    staleRecordFiles: number;
    missingRecordFiles: number;
  };
  errors: DatasetConsistencyIssue[];
  warnings: DatasetConsistencyIssue[];
};

function obj(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/**
 * Normalize a build identifier to `<version>:<changelist>` so publication
 * suffixes ("-scintel.12", "-blueprint-filter.3") do not count as a different
 * game build, while a different version or changelist does.
 */
export function gameBuildKey(buildId: string | null | undefined): string | null {
  if (!buildId) return null;
  const match = /^(\d+(?:\.\d+)+)[-.](?:[a-z]+[-.])?(\d{6,})/i.exec(buildId);
  return match ? `${match[1]}:${match[2]}` : buildId;
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

function listJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJson(full);
    return entry.name.endsWith(".json") ? [full] : [];
  });
}

function collectLinks(value: unknown, out: { contractIds: Set<string>; offerKeys: Set<string> }): void {
  if (Array.isArray(value)) {
    for (const item of value) collectLinks(item, out);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value as JsonObject)) {
    if (key === "offerKey" && typeof item === "string") out.offerKeys.add(item);
    else if (key === "contractId" && typeof item === "string") out.contractIds.add(item.toLowerCase());
    else collectLinks(item, out);
  }
}

export type DatasetConsistencyRoots = {
  serverDataRoot: string;
  /** Already-parsed mission source catalog; avoids re-reading the large file. */
  missionCatalog?: unknown;
};

export function checkPublishedDatasetConsistency(roots: DatasetConsistencyRoots): DatasetConsistencyReport {
  const errors: DatasetConsistencyIssue[] = [];
  const warnings: DatasetConsistencyIssue[] = [];
  const sd = roots.serverDataRoot;
  const missionsRoot = path.join(sd, "missions");
  const bsRoot = path.join(sd, "crafting", "blueprint-sources");

  const pointer = obj(readJson(path.join(missionsRoot, "current.json")));
  const pointerGenerationId = str(pointer.generationId);
  const tuple = `${String(pointer.missionSchemaVersion)}/${String(pointer.sourceContractVersion)}/${String(pointer.offerSchemaVersion ?? "-")}`;
  const generationRoot = path.join(missionsRoot, str(pointer.generationPath) ?? "__missing__");
  if (!existsSync(generationRoot)) {
    errors.push({ code: "mission_generation_missing", message: `Mission pointer selects a missing generation: ${String(pointer.generationPath)}` });
  }
  const genIndex = existsSync(generationRoot) ? obj(readJson(path.join(generationRoot, "mission_browser_index.json"))) : {};
  const genManifest = existsSync(generationRoot) ? obj(readJson(path.join(generationRoot, "mission_shard_manifest.json"))) : {};
  const catalog = obj(roots.missionCatalog ?? readJson(path.join(missionsRoot, "source", "mission_contracts.json")));
  const catalogSource = obj(catalog.source);
  const catalogRecords = Array.isArray(catalog.records) ? (catalog.records as JsonObject[]) : [];
  const refIndex = obj(obj(genIndex.sourceInputs).refIndex);

  if (str(genIndex.generationId) !== pointerGenerationId || str(genManifest.generationId) !== pointerGenerationId) {
    errors.push({ code: "mission_generation_identity", message: "Mission pointer, browser index, and shard manifest generation IDs disagree." });
  }
  if (
    genIndex.schemaVersion !== pointer.missionSchemaVersion
    || genIndex.sourceContractVersion !== pointer.sourceContractVersion
    || (genIndex.offerSchemaVersion ?? undefined) !== (pointer.offerSchemaVersion ?? undefined)
  ) {
    errors.push({ code: "mission_generation_tuple", message: `Mission generation tuple does not match pointer tuple ${tuple}.` });
  }
  const sourceAt = str(catalog.sourceLatestModifiedAt);
  const genSourceAt = str(genIndex.sourceLatestModifiedAt);
  if (sourceAt !== genSourceAt) {
    errors.push({ code: "mission_source_snapshot", message: `Mission source snapshot ${sourceAt} does not match active generation snapshot ${genSourceAt}.` });
  }
  const sourceBuildId = str(catalogSource.sourceBuildId);
  const refBuildId = str(refIndex.buildId);
  if (pointer.offerSchemaVersion === 1 && refIndex.status !== "explicit") {
    errors.push({ code: "mission_ref_index_status", message: "Offer-capable generation was not shaped with an explicit reference index." });
  }
  if (sourceBuildId && refBuildId && gameBuildKey(sourceBuildId) !== gameBuildKey(refBuildId)) {
    errors.push({ code: "mission_cross_build_ref_index", message: `Mission source build ${sourceBuildId} was joined with reference index build ${refBuildId}.` });
  }

  // Blueprint sources -> mission generation.
  const bsIndex = obj(readJson(path.join(bsRoot, "index.json")));
  const bsGeneration = obj(bsIndex.missionGeneration);
  const bsGenerationId = str(bsGeneration.generationId);
  if (pointer.offerSchemaVersion === 1 || bsGenerationId) {
    if (bsGenerationId !== pointerGenerationId) {
      errors.push({ code: "blueprint_sources_generation", message: `Blueprint sources were shaped from mission generation ${bsGenerationId}; active generation is ${pointerGenerationId}.` });
    }
    if (
      bsGeneration.missionSchemaVersion !== pointer.missionSchemaVersion
      || bsGeneration.sourceContractVersion !== pointer.sourceContractVersion
      || (bsGeneration.offerSchemaVersion ?? undefined) !== (pointer.offerSchemaVersion ?? undefined)
    ) {
      errors.push({ code: "blueprint_sources_tuple", message: "Blueprint sources mission tuple does not match the active pointer." });
    }
  }
  if (str(bsIndex.sourceLatestModifiedAt) !== sourceAt) {
    errors.push({ code: "blueprint_sources_snapshot", message: `Blueprint sources snapshot ${String(bsIndex.sourceLatestModifiedAt)} does not match mission source snapshot ${sourceAt}.` });
  }

  const blueprintFiles = obj(bsIndex.blueprintFiles) as Record<string, string>;
  const missionFiles = obj(bsIndex.missionFiles) as Record<string, string>;
  const indexedFiles = new Set([...Object.values(blueprintFiles), ...Object.values(missionFiles)].map((f) => path.resolve(bsRoot, f)));
  const missingFiles = [...indexedFiles].filter((f) => !existsSync(f));
  const links = { contractIds: new Set<string>(), offerKeys: new Set<string>() };
  const stale: string[] = [];
  for (const file of listJson(bsRoot)) {
    const record = readJson(file);
    collectLinks(record, links);
    const recordGeneration = str(obj(obj(record).missionGeneration).generationId);
    if (recordGeneration && recordGeneration !== bsGenerationId) stale.push(path.relative(bsRoot, file));
  }
  if (missingFiles.length) {
    errors.push({ code: "blueprint_sources_missing_files", message: "Blueprint source index lists files that do not exist.", count: missingFiles.length, examples: missingFiles.slice(0, 5).map((f) => path.relative(bsRoot, f)) });
  }
  if (stale.length) {
    errors.push({ code: "blueprint_sources_partial_reshape", message: "Blueprint source record files carry a different mission generation than their index.", count: stale.length, examples: stale.slice(0, 5) });
  }

  const variantFiles = obj(genIndex.variantDetailFiles);
  const variantIds = new Set(Object.keys(variantFiles).map((k) => k.toLowerCase()));
  const offerFiles = new Set(Object.keys(obj(genManifest.offerDetailFiles)));
  const unresolvedContracts = [...links.contractIds].filter((id) => !variantIds.has(id));
  const unresolvedOffers = pointer.offerSchemaVersion === 1 ? [...links.offerKeys].filter((k) => !offerFiles.has(k)) : [];
  if (unresolvedContracts.length) {
    errors.push({ code: "blueprint_sources_unresolved_contract", message: "Blueprint sources reference contracts absent from the active mission generation.", count: unresolvedContracts.length, examples: unresolvedContracts.slice(0, 5) });
  }
  if (unresolvedOffers.length) {
    errors.push({ code: "blueprint_sources_unresolved_offer", message: "Blueprint sources reference offers absent from the active mission generation.", count: unresolvedOffers.length, examples: unresolvedOffers.slice(0, 5) });
  }

  // Blueprint sources -> recipes (stable blueprint GUIDs).
  const recipesIndexPath = path.join(sd, "crafting", "recipes", "index.json");
  const recipesIndex = existsSync(recipesIndexPath) ? obj(readJson(recipesIndexPath)) : {};
  const recipeGuids = new Set(
    [...(Array.isArray(recipesIndex.vehicleBlueprintGuids) ? recipesIndex.vehicleBlueprintGuids : []),
      ...(Array.isArray(recipesIndex.fpsBlueprintGuids) ? recipesIndex.fpsBlueprintGuids : [])]
      .map((g) => String(g).toLowerCase()),
  );
  const withoutRecipe = Object.keys(blueprintFiles).filter((g) => !recipeGuids.has(g.toLowerCase()));
  if (withoutRecipe.length) {
    warnings.push({ code: "blueprint_source_without_recipe", message: "Mission-rewarded blueprints with no published recipe.", count: withoutRecipe.length, examples: withoutRecipe.slice(0, 5) });
  }

  const cardsIndexPath = path.join(sd, "crafting", "component-cards", "index.json");
  const cardsIndex = existsSync(cardsIndexPath) ? obj(readJson(cardsIndexPath)) : {};

  // Fitting pointer -> build directory.
  const fittingPointerPath = path.join(sd, "fitting", "current.json");
  const fittingChannels = existsSync(fittingPointerPath) ? obj(obj(readJson(fittingPointerPath)).channels) : {};
  const currentBuildIds: Record<string, string> = {};
  const missingBuildDirectories: string[] = [];
  for (const [channel, value] of Object.entries(fittingChannels)) {
    const buildId = str(obj(value).currentBuildId);
    if (!buildId) continue;
    currentBuildIds[channel] = buildId;
    if (!existsSync(path.join(sd, "fitting", channel, buildId))) missingBuildDirectories.push(`${channel}/${buildId}`);
  }
  if (missingBuildDirectories.length) {
    errors.push({ code: "fitting_build_missing", message: "Fitting pointer selects a missing build directory.", examples: missingBuildDirectories });
  }
  const liveFitting = currentBuildIds.LIVE;
  if (liveFitting && sourceBuildId && gameBuildKey(liveFitting) !== gameBuildKey(sourceBuildId)) {
    warnings.push({ code: "fitting_mission_build_differs", message: `LIVE fitting build ${liveFitting} differs from mission source build ${sourceBuildId}. No direct join exists today; review before cross-linking.` });
  }

  const blueprintContractCount = catalogRecords.filter((r) => Array.isArray(r.blueprintRewards) && r.blueprintRewards.length > 0).length;

  return {
    schemaVersion: 1,
    ok: errors.length === 0,
    datasets: {
      missions: {
        pointerGenerationId,
        tuple,
        sourceBuildId,
        sourceLatestModifiedAt: sourceAt,
        generationSourceLatestModifiedAt: genSourceAt,
        refIndexBuildId: refBuildId,
        refIndexStatus: str(refIndex.status),
        variantCount: variantIds.size,
        catalogContractCount: catalogRecords.length,
        catalogBlueprintContractCount: blueprintContractCount,
      },
      blueprintSources: {
        missionGenerationId: bsGenerationId,
        sourceLatestModifiedAt: str(bsIndex.sourceLatestModifiedAt),
        blueprintFileCount: Object.keys(blueprintFiles).length,
        missionFileCount: Object.keys(missionFiles).length,
        generatedAt: str(bsIndex.generatedAt),
      },
      craftingRecipes: { buildIdentity: "unrecorded", sourceGeneratedAt: str(recipesIndex.sourceGeneratedAt), blueprintCount: recipeGuids.size },
      componentCards: { buildIdentity: "unrecorded", sourceGeneratedAt: str(cardsIndex.sourceGeneratedAt) },
      fitting: { currentBuildIds, missingBuildDirectories },
    },
    links: {
      blueprintSourceContractIds: links.contractIds.size,
      blueprintSourceOfferKeys: links.offerKeys.size,
      blueprintGuids: Object.keys(blueprintFiles).length,
      unresolvedContractIds: unresolvedContracts.length,
      unresolvedOfferKeys: unresolvedOffers.length,
      blueprintGuidsWithoutRecipe: withoutRecipe.length,
      staleRecordFiles: stale.length,
      missingRecordFiles: missingFiles.length,
    },
    errors,
    warnings,
  };
}
