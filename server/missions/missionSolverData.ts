import { readFile } from "node:fs/promises";
import path from "node:path";

import { getMissionDataRoot } from "../config/missionDataRoot.js";
import { evaluateMissionEligibility } from "./missionEligibility.js";
import { solveMissionPath } from "./missionPathSolver.js";
import type {
  MissionEligibilityContext,
  MissionEligibilityResult,
  MissionGraphValidationReport,
  MissionPathGoal,
  MissionPathSolveOptions,
  MissionPathSolveResult,
  MissionSolverGraph,
  MissionSolverVariant,
  PlayerMissionState,
} from "./missionSolverTypes.js";

type MissionShardManifest = {
  schemaVersion: 2 | 3;
  sourceContractVersion: 3 | 4;
  offerSchemaVersion?: 1;
  generationId: string;
  variantFilesByMissionId?: Record<string, { detailFile: string }>;
  variantFilesByVariantId?: Record<string, { detailFile: string }>;
};

type MissionVariantEnvelope = {
  schemaVersion: 2 | 3;
  sourceContractVersion: 3 | 4;
  offerSchemaVersion?: 1;
  generationId: string;
  variant: {
    canonical?: MissionSolverVariant;
  };
};

type MissionSolverReference = {
  schemaVersion: 1;
  missionSchemaVersion: 2 | 3;
  sourceContractVersion: 3 | 4;
  generationId: string;
  standingThresholdsById: Record<string, number>;
};

type MissionSolverGeneration = {
  root: string;
  graph: MissionSolverGraph;
  report: MissionGraphValidationReport;
  manifest: MissionShardManifest;
  reference: MissionSolverReference;
  variants: Map<string, Promise<MissionSolverVariant>>;
};

const generationCache = new Map<string, Promise<MissionSolverGeneration>>();

export type MissionSolverArtifactGeneration = {
  schemaVersion: number;
  sourceContractVersion: number;
  offerSchemaVersion?: number;
  generationId: string;
};

async function readJson<T>(root: string, relativePath: string): Promise<T> {
  const filePath = path.resolve(root, relativePath);
  const relativeToRoot = path.relative(root, filePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("Invalid mission solver data path.");
  }
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function isSupportedArtifactGeneration(artifact: MissionSolverArtifactGeneration): boolean {
  return (
    artifact.schemaVersion === 2
    && artifact.sourceContractVersion === 3
    && artifact.offerSchemaVersion === undefined
  ) || (
    artifact.schemaVersion === 3
    && artifact.sourceContractVersion === 4
    && artifact.offerSchemaVersion === 1
  );
}

export function assertMissionSolverArtifactGeneration(
  graph: MissionSolverArtifactGeneration,
  report: MissionSolverArtifactGeneration,
  manifest: MissionSolverArtifactGeneration,
): void {
  const artifacts = [graph, report, manifest];
  if (!artifacts.every(isSupportedArtifactGeneration)) {
    throw new Error(
      "Mission solver requires shaped/source schema 2/3 or shaped/source/offer schema 3/4/1.",
    );
  }
  if (artifacts.some((artifact) => (
    artifact.schemaVersion !== graph.schemaVersion
    || artifact.sourceContractVersion !== graph.sourceContractVersion
    || artifact.offerSchemaVersion !== graph.offerSchemaVersion
  ))) {
    throw new Error("Mission solver artifacts use different schema contracts.");
  }
  if (
    !graph.generationId
    || graph.generationId !== report.generationId
    || graph.generationId !== manifest.generationId
  ) {
    throw new Error("Mission solver artifacts belong to different generations.");
  }
}

async function loadGeneration(root = getMissionDataRoot()): Promise<MissionSolverGeneration> {
  let cached = generationCache.get(root);
  if (!cached) {
    cached = Promise.all([
      readJson<MissionSolverGraph>(root, "mission_graph.json"),
      readJson<MissionGraphValidationReport>(root, "mission_graph_validation_report.json"),
      readJson<MissionShardManifest>(root, "mission_shard_manifest.json"),
      readJson<MissionSolverReference>(root, "mission_solver_reference.json"),
    ]).then(([graph, report, manifest, reference]) => {
      assertMissionSolverArtifactGeneration(graph, report, manifest);
      if (
        reference.schemaVersion !== 1
        || reference.missionSchemaVersion !== graph.schemaVersion
        || reference.sourceContractVersion !== graph.sourceContractVersion
        || reference.generationId !== graph.generationId
      ) {
        throw new Error("Mission solver reference belongs to a different generation.");
      }
      return { root, graph, report, manifest, reference, variants: new Map() };
    });
    generationCache.set(root, cached);
  }
  return cached;
}

async function loadVariant(
  generation: MissionSolverGeneration,
  variantId: string,
): Promise<MissionSolverVariant> {
  let cached = generation.variants.get(variantId);
  if (!cached) {
    const entry = generation.manifest.variantFilesByVariantId?.[variantId]
      ?? generation.manifest.variantFilesByMissionId?.[variantId];
    if (!entry?.detailFile) {
      throw new Error(`Mission solver variant ${variantId} is not published.`);
    }
    cached = readJson<MissionVariantEnvelope>(generation.root, entry.detailFile).then((envelope) => {
      if (
        envelope.generationId !== generation.graph.generationId
        || !envelope.variant.canonical
        || envelope.variant.canonical.identity.variantId !== variantId
      ) {
        throw new Error(`Mission solver variant ${variantId} has an invalid canonical envelope.`);
      }
      try {
        assertMissionSolverArtifactGeneration(
          generation.graph,
          generation.graph,
          envelope,
        );
      } catch {
        throw new Error(`Mission solver variant ${variantId} has an invalid canonical envelope.`);
      }
      return envelope.variant.canonical;
    });
    generation.variants.set(variantId, cached);
  }
  return cached;
}

async function loadGoalClosure(
  generation: MissionSolverGeneration,
  goal: MissionPathGoal,
): Promise<Map<string, MissionSolverVariant>> {
  const variants = new Map<string, MissionSolverVariant>();
  const dependenciesByTag = new Map<string, typeof generation.graph.dependencies>();
  const dependenciesByConsumer = new Map<string, typeof generation.graph.dependencies>();
  for (const dependency of generation.graph.dependencies) {
    const byTag = dependenciesByTag.get(dependency.completionTag) ?? [];
    byTag.push(dependency);
    dependenciesByTag.set(dependency.completionTag, byTag);
    const byConsumer = dependenciesByConsumer.get(dependency.consumerVariantId) ?? [];
    byConsumer.push(dependency);
    dependenciesByConsumer.set(dependency.consumerVariantId, byConsumer);
  }

  const pendingTags: string[] = [];
  if (goal.type === "completion_tag") {
    pendingTags.push(goal.completionTag);
  } else {
    const target = await loadVariant(generation, goal.variantId);
    variants.set(goal.variantId, target);
    pendingTags.push(
      ...(dependenciesByConsumer.get(goal.variantId) ?? []).map((dependency) => dependency.completionTag),
    );
  }

  const visitedTags = new Set<string>();
  const visitedVariants = new Set(variants.keys());
  while (pendingTags.length > 0) {
    const tag = pendingTags.pop();
    if (!tag || visitedTags.has(tag)) continue;
    visitedTags.add(tag);
    const producerIds = new Set(
      (dependenciesByTag.get(tag) ?? []).flatMap((dependency) => dependency.producerVariantIds),
    );
    for (const producerId of [...producerIds].sort()) {
      if (visitedVariants.has(producerId)) continue;
      visitedVariants.add(producerId);
      const producer = await loadVariant(generation, producerId);
      variants.set(producerId, producer);
      pendingTags.push(
        ...(dependenciesByConsumer.get(producerId) ?? []).map((dependency) => dependency.completionTag),
      );
    }
  }
  return variants;
}

export async function evaluateCurrentMissionEligibility(
  variantId: string,
  playerState: PlayerMissionState,
  context: MissionEligibilityContext = {},
): Promise<MissionEligibilityResult> {
  const generation = await loadGeneration();
  const variant = await loadVariant(generation, variantId);
  return evaluateMissionEligibility(variant, playerState, {
    standingThresholdsById: generation.reference.standingThresholdsById,
    ...context,
  });
}

export async function evaluateCurrentMissionEligibilityEnvelope(
  variantId: string,
  playerState: PlayerMissionState,
  context: Pick<MissionEligibilityContext, "locationPropertyBindings"> = {},
): Promise<{ generationId: string; result: MissionEligibilityResult }> {
  const generation = await loadGeneration();
  const variant = await loadVariant(generation, variantId);
  const result = evaluateMissionEligibility(variant, playerState, {
    standingThresholdsById: generation.reference.standingThresholdsById,
    locationPropertyBindings: context.locationPropertyBindings,
  });
  return { generationId: generation.graph.generationId, result };
}

export async function solveCurrentMissionPath(
  goal: MissionPathGoal,
  playerState: PlayerMissionState,
  context: MissionEligibilityContext = {},
  options: MissionPathSolveOptions = {},
): Promise<MissionPathSolveResult> {
  const generation = await loadGeneration();
  const variants = await loadGoalClosure(generation, goal);
  const resolvedContext = {
    standingThresholdsById: generation.reference.standingThresholdsById,
    ...context,
  };
  return solveMissionPath({
    generationId: generation.graph.generationId,
    graph: generation.graph,
    validationReport: generation.report,
    variants,
    playerState,
    eligibilityContext: resolvedContext,
    goal,
    options,
  });
}
