import type { JsonObject, MissionSourceEdgeV3, MissionSourceRecordV3 } from "../schema/source-v3.mts";

export type MissionDependencyV2 = {
  prerequisiteEdgeId: string;
  consumerVariantId: string;
  completionTag: string;
  producerVariantIds: string[];
  resolution: "resolved_unique" | "resolved_alternatives" | "dangling";
};

export type MissionDependencyArcV2 = {
  producerVariantId: string;
  consumerVariantId: string;
  completionTag: string;
  prerequisiteEdgeId: string;
};

export type MissionGraphDiagnosticV2 = {
  code:
    | "dangling_required_completion_tag"
    | "dangling_excluded_completion_tag"
    | "dangling_branch_completion_tag"
    | "alternate_completion_tag_producers"
    | "dependency_cycle";
  severity: "warning" | "error";
  variantId?: string;
  edgeId?: string;
  tag?: string;
  details: JsonObject;
};

export type MissionGraphValidationV2 = {
  schemaVersion: 2;
  nodeCount: number;
  producerTagCount: number;
  dependencies: MissionDependencyV2[];
  arcs: MissionDependencyArcV2[];
  branchDependencies: MissionDependencyV2[];
  excludedConstraints: MissionDependencyV2[];
  cycles: Array<{
    variantIds: string[];
    arcs: MissionDependencyArcV2[];
  }>;
  diagnostics: MissionGraphDiagnosticV2[];
  summary: {
    requiredTagCount: number;
    danglingRequiredTagCount: number;
    excludedTagCount: number;
    danglingExcludedTagCount: number;
    alternateProducerTagCount: number;
    branchRequiredTagCount: number;
    danglingBranchTagCount: number;
    cycleComponentCount: number;
  };
};

function prerequisiteTag(edge: MissionSourceEdgeV3): string | undefined {
  const value = edge.identifiers?.completionTag;
  return typeof value === "string" && value ? value : undefined;
}

function outcomeTag(edge: MissionSourceEdgeV3): string | undefined {
  const value = edge.payload?.tag;
  return typeof value === "string" && value ? value : undefined;
}

function completionTagPrerequisites(
  record: MissionSourceRecordV3,
  polarity: "required" | "excluded",
): MissionSourceEdgeV3[] {
  return record.prerequisiteEdges.filter(
    (edge) => edge.type === "completion_tag" && edge.polarity === polarity && prerequisiteTag(edge),
  );
}

function makeDependency(
  edge: MissionSourceEdgeV3,
  producersByTag: Map<string, string[]>,
): MissionDependencyV2 {
  const completionTag = prerequisiteTag(edge)!;
  const producerVariantIds = producersByTag.get(completionTag) ?? [];
  return {
    prerequisiteEdgeId: edge.edgeId,
    consumerVariantId: edge.variantId,
    completionTag,
    producerVariantIds,
    resolution: producerVariantIds.length === 0
      ? "dangling"
      : producerVariantIds.length === 1
        ? "resolved_unique"
        : "resolved_alternatives",
  };
}

function stronglyConnectedComponents(nodes: string[], arcs: MissionDependencyArcV2[]): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node, []);
  for (const arc of arcs) {
    adjacency.set(arc.producerVariantId, [
      ...(adjacency.get(arc.producerVariantId) ?? []),
      arc.consumerVariantId,
    ]);
  }

  let nextIndex = 0;
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];

  const visit = (node: string) => {
    indices.set(node, nextIndex);
    lowLinks.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);

    for (const neighbor of adjacency.get(node) ?? []) {
      if (!indices.has(neighbor)) {
        visit(neighbor);
        lowLinks.set(node, Math.min(lowLinks.get(node)!, lowLinks.get(neighbor)!));
      } else if (onStack.has(neighbor)) {
        lowLinks.set(node, Math.min(lowLinks.get(node)!, indices.get(neighbor)!));
      }
    }

    if (lowLinks.get(node) !== indices.get(node)) return;
    const component: string[] = [];
    while (stack.length) {
      const member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
      if (member === node) break;
    }
    components.push(component.sort());
  };

  for (const node of [...nodes].sort()) {
    if (!indices.has(node)) visit(node);
  }
  return components;
}

export function buildMissionGraphValidationV2(records: MissionSourceRecordV3[]): MissionGraphValidationV2 {
  const recordIds = new Set(records.map((record) => record.contractId));
  const producersByTag = new Map<string, string[]>();
  for (const record of records) {
    for (const outcome of record.outcomeEdges.filter((edge) => edge.type === "completion_tag")) {
      const tag = outcomeTag(outcome);
      if (!tag) continue;
      producersByTag.set(tag, [...new Set([...(producersByTag.get(tag) ?? []), record.contractId])].sort());
    }
  }

  const dependencies = records.flatMap((record) =>
    completionTagPrerequisites(record, "required").map((edge) => makeDependency(edge, producersByTag))
  );
  const excludedConstraints = records.flatMap((record) =>
    completionTagPrerequisites(record, "excluded").map((edge) => makeDependency(edge, producersByTag))
  );
  const branchDependencies = records.flatMap((record) =>
    Object.values(record.subContractPrerequisiteEdges ?? {}).flatMap((edges) =>
      edges
        .filter((edge) => edge.type === "completion_tag" && edge.polarity === "required" && prerequisiteTag(edge))
        .map((edge) => makeDependency(edge, producersByTag))
    )
  );
  const arcs = dependencies.flatMap((dependency) =>
    dependency.producerVariantIds
      .filter((producerVariantId) => recordIds.has(producerVariantId))
      .map((producerVariantId) => ({
        producerVariantId,
        consumerVariantId: dependency.consumerVariantId,
        completionTag: dependency.completionTag,
        prerequisiteEdgeId: dependency.prerequisiteEdgeId,
      }))
  );

  const components = stronglyConnectedComponents([...recordIds], arcs);
  const cycles = components
    .filter((component) => component.length > 1 || arcs.some(
      (arc) => arc.producerVariantId === component[0] && arc.consumerVariantId === component[0],
    ))
    .map((variantIds) => {
      const members = new Set(variantIds);
      return {
        variantIds,
        arcs: arcs.filter(
          (arc) => members.has(arc.producerVariantId) && members.has(arc.consumerVariantId),
        ),
      };
    });

  const diagnostics: MissionGraphDiagnosticV2[] = [];
  for (const dependency of dependencies.filter((item) => item.resolution === "dangling")) {
    diagnostics.push({
      code: "dangling_required_completion_tag",
      severity: "error",
      variantId: dependency.consumerVariantId,
      edgeId: dependency.prerequisiteEdgeId,
      tag: dependency.completionTag,
      details: {},
    });
  }
  for (const dependency of excludedConstraints.filter((item) => item.resolution === "dangling")) {
    diagnostics.push({
      code: "dangling_excluded_completion_tag",
      severity: "warning",
      variantId: dependency.consumerVariantId,
      edgeId: dependency.prerequisiteEdgeId,
      tag: dependency.completionTag,
      details: {},
    });
  }
  for (const dependency of branchDependencies.filter((item) => item.resolution === "dangling")) {
    diagnostics.push({
      code: "dangling_branch_completion_tag",
      severity: "warning",
      variantId: dependency.consumerVariantId,
      edgeId: dependency.prerequisiteEdgeId,
      tag: dependency.completionTag,
      details: {},
    });
  }
  for (const [tag, producerVariantIds] of producersByTag) {
    if (producerVariantIds.length < 2) continue;
    diagnostics.push({
      code: "alternate_completion_tag_producers",
      severity: "warning",
      tag,
      details: { producerVariantIds },
    });
  }
  for (const cycle of cycles) {
    diagnostics.push({
      code: "dependency_cycle",
      severity: "warning",
      details: {
        variantIds: cycle.variantIds,
        arcs: cycle.arcs,
      },
    });
  }

  const requiredTags = new Set(dependencies.map((item) => item.completionTag));
  const danglingRequiredTags = new Set(
    dependencies.filter((item) => item.resolution === "dangling").map((item) => item.completionTag),
  );
  const excludedTags = new Set(excludedConstraints.map((item) => item.completionTag));
  const danglingExcludedTags = new Set(
    excludedConstraints.filter((item) => item.resolution === "dangling").map((item) => item.completionTag),
  );
  const branchTags = new Set(branchDependencies.map((item) => item.completionTag));
  const danglingBranchTags = new Set(
    branchDependencies.filter((item) => item.resolution === "dangling").map((item) => item.completionTag),
  );

  return {
    schemaVersion: 2,
    nodeCount: recordIds.size,
    producerTagCount: producersByTag.size,
    dependencies,
    arcs,
    branchDependencies,
    excludedConstraints,
    cycles,
    diagnostics,
    summary: {
      requiredTagCount: requiredTags.size,
      danglingRequiredTagCount: danglingRequiredTags.size,
      excludedTagCount: excludedTags.size,
      danglingExcludedTagCount: danglingExcludedTags.size,
      alternateProducerTagCount: [...producersByTag.values()].filter((ids) => ids.length > 1).length,
      branchRequiredTagCount: branchTags.size,
      danglingBranchTagCount: danglingBranchTags.size,
      cycleComponentCount: cycles.length,
    },
  };
}
