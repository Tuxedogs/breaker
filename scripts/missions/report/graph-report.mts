import type { MissionGraphValidationV2 } from "../graph/mission-graph.mts";

export type MissionGenerationEnvelopeV2 = {
  schemaVersion: 2;
  sourceContractVersion: 3;
  generationId: string;
  generatedAt: string;
  sourceLatestModifiedAt: string;
};

export function buildMissionGraphArtifactsV2(
  envelope: MissionGenerationEnvelopeV2,
  graph: MissionGraphValidationV2,
): {
  graph: MissionGenerationEnvelopeV2 & {
    nodeCount: number;
    dependencies: MissionGraphValidationV2["dependencies"];
    arcs: MissionGraphValidationV2["arcs"];
    branchDependencies: MissionGraphValidationV2["branchDependencies"];
    excludedConstraints: MissionGraphValidationV2["excludedConstraints"];
  };
  report: MissionGenerationEnvelopeV2 & {
    summary: MissionGraphValidationV2["summary"];
    cycles: MissionGraphValidationV2["cycles"];
    diagnostics: MissionGraphValidationV2["diagnostics"];
  };
} {
  return {
    graph: {
      ...envelope,
      nodeCount: graph.nodeCount,
      dependencies: graph.dependencies,
      arcs: graph.arcs,
      branchDependencies: graph.branchDependencies,
      excludedConstraints: graph.excludedConstraints,
    },
    report: {
      ...envelope,
      summary: graph.summary,
      cycles: graph.cycles,
      diagnostics: graph.diagnostics,
    },
  };
}
